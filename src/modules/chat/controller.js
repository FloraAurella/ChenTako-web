import { AUXILIARY_CHAT_ROUTES } from '../../contracts/auxiliary';
import { beginFirstResponse, endFirstResponse, isConversationLocked, FIRST_RESPONSE_LOCK_REASON } from './domain/first-response.js';
import { createTitleGeneration, firstInputDescription } from './services/title-generation.js';
import { captureAuxiliaryModel, validateAuxiliaryInput } from './services/auxiliary-models.js';
import { createComposerCommands, parseCommandInput } from '../commands/public/composer';
import { selectRuntimeModel, selectRuntimeEffort } from './services/runtime-selection.js';
import { Scope } from "../../core/scope";
import { createPopoverController } from "../../shared/overlays/popover-controller.js";
"use strict";

/**
 * Chat 页面控制器：侧栏目录、消息流、SSE 流式管线（rAF 合帧、
 * 只更新当前助手消息节点）、输入信纸、模型/努力度/额度三个浮层、
 * 消息编辑与分支、上下文压缩、附件与多模态、灯箱。
 */

import { apiFetch } from "../../shared/api.js";
import { flushSync } from "react-dom";
import { renderMarkdown } from "../../shared/markdown.js";
import {
  normalizeProviderResponse,
} from "../connections/public/domain_adapters.js";
import { normalizeToolEvents } from "./services/runtime-events.js";
import { renderAssistantFlowHtml } from "./services/message-rendering.js";
import { mountImageGenerationSlot, paintStreamImages } from "./services/stream-images.ts";
import {
  collectAttachmentItems,
  createAttachmentBudget,
  createMessageAttachmentBudget,
  dataUrlBlob
} from "../attachments/public/services_attachments.js";
import {
  contextTooltipLinesMarkup,
  effortPanelMarkup,
  modelPanelMarkup,
  runtimeRootPanelMarkup
} from "./services/popover-markup.js";
import { resolveChatConfig, modelCompatibility } from "../context/public/domain_config.js";
import { estimateContextTokens, resolveInputBudget, compressionPrefix, shouldCompressResponse } from "../context/public/domain_budget.js";
import { computeContextUsage } from "../context/public/services_context-usage.js";
import { createConversationActions } from "./services/conversation-actions.js";
import {
  consumeAppStreamFrame,
  finalizeAppStreamState,
  readSseStream,
  createStreamRegistry
} from "./stream/index.ts";
import {
  contextMessages,
  getValidContextCompression,
  getMessagesAfterCompression,
  invalidateCompressionForIndex,
  sortConversations
} from "./domain/queries.js";
import { normalizeOutputImages, normalizeOutputFiles } from "../../contracts/normalize.js";
import {
  flattenVisiblePrefix,
  appendToActivePath,
  forkUserMessage,
  getActivePath,
  getMessageSubtreeIds,
  getUserVariants,
  removeMessageSubtree,
  selectMessageVariant,
  repairActiveSelections
} from "./domain/tree.js";
import { resolveEffectiveModelConfig } from "../connections/public/domain_models.js";
import {
  enabledExtensions
} from "../extensions/public/domain_model.js";
import {
  EFFORT_LEVELS,
  DEFAULT_EFFORT,
  LIMITS,
  effortLevelOf
} from "../../contracts/constants.js";
import { icon } from "../../resources/icons/index.js";
import {
  formatDuration,
  truncateText,
  downloadBlob,
  copyText,
  safeFilename
} from "../../shared/utils.js";

const SUGGESTIONS = [
  "帮我给一份周报拟三个清晰的小标题",
  "把这段思路整理成一份可执行的清单",
  "用一段话解释这个概念，像写给同事的信"
];

// 流式跟随锁定：解除跟随只认用户向上的滚动手势（滚轮 / 触摸 / 滚动条 / 翻页键），
// 内容增长与程序回底引发的 scroll 事件不再误判；滚回距底部 48px 内自动重新锁定。
const FOLLOW_REENGAGE_PX = 48;
const FOLLOW_RELEASE_PX = 96;
const SCROLLBAR_HIT_PX = 14;
// 连续滚轮/触摸输入停止一小段时间后再补绘流内容，把主线程优先留给原生滚动。
const STREAM_SCROLL_IDLE_MS = 140;
// 长回复的正文重绘节流：rAF 合帧之上再按 ~80ms 合帧，整段 Markdown 不必每帧重解析
const STREAM_BODY_PAINT_MS = 48;
// 流式条目整体在视口下方超过该余量且用户已解锁阅读时，暂停其 DOM 重绘
const STREAM_VIEWPORT_LEAD_PX = 240;
const MAX_ARTIFACT_SOURCE_BYTES = 2 * 1024 * 1024;

function reasoningBodyId(messageId) {
  return `reasoning-body-${String(messageId || "message").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function setReasoningSheetOpen(sheet, open) {
  const value = String(Boolean(open));
  sheet.dataset.open = value;
  sheet.querySelector(".reasoning-toggle")?.setAttribute("aria-expanded", value);
}

function streamMetric(name, amount = 1) {
  const metrics = window.__AI_CHATBOX_STREAM_METRICS__;
  if (metrics) metrics[name] = Number(metrics[name] || 0) + amount;
}

export function createChatController({ store, theme, dialogs, shell, toast, backendStatusHtml, closeDrawerIfOverlay, commandRegistry, requestContexts }) {
  const scope = new Scope();
  const page = shell.pageChat;
  let els = null;
  const titleGeneration = createTitleGeneration({ store, scope, toast });
  const allowChange = conversation => { if (!isConversationLocked(conversation)) return true; toast(FIRST_RESPONSE_LOCK_REASON, { tone: "danger" }); return false; };
  // 进行中的流按会话并行：切换会话不打断后台流，切回时继续原进度渲染
  const streams = createStreamRegistry({
    isVisible: (conversationId) => {
      if (conversationId !== state().activeConversationId || state().route.name !== "chat") return false;
      if (userScrollActive) return false;
      const stream = streams.get(conversationId);
      const conversation = state().conversations.find((item) => item.id === conversationId);
      return Boolean(stream && conversation && getActivePath(conversation)
        .some((message) => message.id === stream.messageId));
    },
    publish: (stream) => paint(stream)
  });
  const compressionRequests = new Map();
  scope.defer(() => { for (const abort of compressionRequests.values()) abort.abort(); compressionRequests.clear(); });
  scope.defer(store.subscribe(() => {
    for (const [id, abort] of compressionRequests) if (!state().conversations.some(c => c.id === id)) abort.abort();
  }));
  scope.defer(() => { for (const conversation of state().conversations) endFirstResponse(conversation); });
  const compressingIds = new Set();   // 正在压缩上下文的会话 ID（按会话锁定请求）
  let followStream = true;
  let scrollbarDragging = false;
  let lastTouchY = 0;
  let userScrollActive = false;
  let scrollIdleTimer = 0;
  let followFrame = 0;
  let settleFollowGeneration = 0;
  let editingMessageId = "";
  let editingDraft = null;
  const popovers = createPopoverController({host:shell.popoverHost,beforeOpen:() => hideContextTooltip()});
  const {openPopover,closeActivePopover} = popovers;
  let contextTooltipTimer = 0;
  let contextTooltipEl = null;
  let attachmentInput = null;
  let commands = null;

  // ============ 基础工具 ============

  const state = () => store.state;

  function activeConversation() {
    return store.activeConversation();
  }

  function conversationProvider(conversation) {
    return state().providers.find((provider) => provider.id === conversation.providerId) || null;
  }

  function providerHeader(conversation) {
    const provider = conversationProvider(conversation);
    const snap = conversation.providerSnapshot || {};
    return {
      id: provider ? provider.id : "",
      displayName: provider ? provider.displayName : (snap.displayName || "未命名供应商"),
      baseUrl: provider ? provider.baseUrl : (snap.baseUrl || ""),
      responseFormat: provider ? provider.responseFormat : (snap.responseFormat || "openai-compatible")
    };
  }

  function contextWindowOf(conversation) {
    const provider = conversationProvider(conversation);
    return (provider && resolveEffectiveModelConfig(provider, conversation.model).contextWindow) ||
      (conversation.providerSnapshot && conversation.providerSnapshot.contextWindow) ||
      LIMITS.defaultContextWindow;
  }

  function capabilityOf(conversation, key) {
    const provider = conversationProvider(conversation);
    if (!provider) return "auto";
    return modelCompatibility(state(), provider.id, conversation.model)[key] ?? "auto";
  }

  function streamOf(conversationId) {
    return streams.get(conversationId) || null;
  }

  function activeStream() {
    return streamOf(state().activeConversationId);
  }

  const conversationActions = createConversationActions({
    store,
    shell,
    dialogs,
    toast,
    activeConversation,
    focusComposer: () => els?.composerInput.focus(),
    closeDrawerIfOverlay,
    stopStreamForConversation: (conversationId) => stopStream(streamOf(conversationId)),
    openPopover
  });
  const {
    bindSidebarEvents,
    handleShortcutNewConversation
  } = conversationActions;

  function commandContext() {
    const conversation = activeConversation();
    if (!conversation || state().route.name !== "chat") return null;
    const current = () => state().conversations.some(item => item.id === conversation.id);
    const validProvider = conversationProvider(conversation);
    const busy = Boolean(streamOf(conversation.id) || compressingIds.has(conversation.id) || preparingIds.has(conversation.id));
    const unavailable = busy ? "当前会话正在回复、准备发送或压缩，请等待完成后再压缩。"
      : !validProvider || validProvider.enabled === false || !validProvider.models.includes(conversation.model) ? "请选择可用模型后再压缩。"
      : !compressionPrefix(getMessagesAfterCompression(conversation)).length ? "没有可压缩的已完成历史。" : null;
    const missing = { status: 'unavailable', message: '会话已不存在。' };
    return {
      conversationId: conversation.id,
      mutationUnavailable: isConversationLocked(conversation) ? FIRST_RESPONSE_LOCK_REASON : null,
      models: state().providers.filter(p => p.enabled !== false).flatMap(p => p.models.map(model => ({ providerId: p.id, providerName: p.displayName, model, selected: p.id === conversation.providerId && model === conversation.model }))),
      effort: resolveChatConfig(state(), conversation).reasoningEffort,
      followsConfig: !conversation.reasoningEffortOverride, busy, compactUnavailable: unavailable,
      selectModel(providerId, model) {
        if (!current()) return missing;
        const result = selectRuntimeModel(store, conversation, providerId, model);
        renderComposerControls(); renderStageActions(); return result;
      },
      selectEffort(value) {
        if (!current()) return missing;
        const result = selectRuntimeEffort(store, conversation, value);
        renderComposerControls(); return result;
      },
      async compact() {
        if (!current()) return missing;
        const reason = commandContext()?.compactUnavailable;
        if (reason) return { status: 'unavailable', message: reason };
        const ok = await compressContext(conversation);
        return ok ? { status: 'success', message: '历史压缩完成，原聊天记录仍保留。' } : { status: 'error', message: '历史压缩未完成，请检查连接或错误详情后重试。' };
      }
    };
  }

  // ============ 页面骨架 ============

  function renderChatSkeleton() {
    if (!page.querySelector("#messageScroll") || !page.querySelector("#composerInput")) {
      throw new Error("React ChatSurface 未挂载，无法初始化 Chat 运行时");
    }

    els = {
      messageScroll: page.querySelector("#messageScroll"),
      messageList: page.querySelector("#messageList"),
      newRepliesBtn: page.querySelector("#newRepliesBtn"),
      composerPaper: page.querySelector("#composerPaper"),
      composerChips: page.querySelector("#composerChips"),
      composerInput: page.querySelector("#composerInput"),
      attachBtn: page.querySelector("#attachBtn"),
      attachmentInput: page.querySelector("#attachmentInput"),
      runtimeBtn: page.querySelector("#runtimeBtn"),
      modelValue: page.querySelector("#modelValue"),
      effortValue: page.querySelector("#effortValue"),
      usageBtn: page.querySelector("#usageBtn"),
      usageRing: page.querySelector("#usageBtn [data-usage-ring]"),
      sendBtn: page.querySelector("#sendBtn")
    };

    bindMessageDelegation();
    bindComposerEvents();
    if (commandRegistry) commands = createComposerCommands({ input: els.composerInput, registry: commandRegistry, context: commandContext, beforeOpen: closeActivePopover });
  }

  function bindComposerEvents() {
    const input = els.composerInput;
    scope.listen(input, "input", () => {
      autoGrow(input);
      const conversation = activeConversation();
      if (conversation) {
        conversation.draft = input.value.slice(0, LIMITS.draftChars);
        // 草稿走轻量通道：击键不触发全量状态序列化
        store.persistDraftSoon();
      }
      refreshSendButton();
    });
    scope.listen(input, "keydown", (event) => {
      if (event.isComposing) return; // 输入法候选确认的 Enter 不触发发送
      if (commands?.keydown(event)) return;
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submitComposer();
      }
    });
    scope.listen(input, "paste", (event) => {
      const files = event.clipboardData && event.clipboardData.files;
      if (files && files.length) {
        event.preventDefault();
        handleFiles(files);
      }
    });

    ["dragenter", "dragover"].forEach((type) => {
      scope.listen(els.composerPaper, type, (event) => {
        event.preventDefault();
        els.composerPaper.classList.add("drag-over");
      });
    });
    ["dragleave", "drop"].forEach((type) => {
      scope.listen(els.composerPaper, type, (event) => {
        event.preventDefault();
        els.composerPaper.classList.remove("drag-over");
      });
    });
    scope.listen(els.composerPaper, "drop", (event) => {
      if (event.dataTransfer && event.dataTransfer.files.length) {
        handleFiles(event.dataTransfer.files);
      }
    });

    scope.listen(els.sendBtn, "click", () => {
      if (activeStream()) stopStream(activeStream());
      else submitComposer();
    });
    scope.listen(els.attachBtn, "click", () => els.attachmentInput.click());
    scope.listen(els.attachmentInput, "change", () => {
      if (els.attachmentInput.files.length) handleFiles(els.attachmentInput.files);
      els.attachmentInput.value = "";
    });
    scope.listen(els.runtimeBtn, "click", (event) => openRuntimePopover(event.currentTarget));

    // 上下文圆环：hover 延迟粗略提示，focus 立即提示，click 打开完整面板；
    // 触摸设备没有 hover，直接走 click。
    scope.listen(els.usageBtn, "pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      clearTimeout(contextTooltipTimer);
      contextTooltipTimer = scope.timeout(showContextTooltip, 250);
    });
    scope.listen(els.usageBtn, "pointerleave", () => {
      clearTimeout(contextTooltipTimer);
      hideContextTooltip();
    });
    scope.listen(els.usageBtn, "focus", () => {
      clearTimeout(contextTooltipTimer);
      showContextTooltip();
    });
    scope.listen(els.usageBtn, "blur", () => hideContextTooltip());
    scope.listen(els.usageBtn, "click", () => {
      clearTimeout(contextTooltipTimer);
      hideContextTooltip();
      const conversation = activeConversation();
      if (!conversation) return;
      if (compressingIds.has(conversation.id)) {
        toast("正在压缩上下文，请稍候", { tone: "danger" });
        return;
      }
      if (streamOf(conversation.id)) {
        toast("本对话正在生成回复", { tone: "danger" });
        return;
      }
      compressContext(conversation);
    });

    scope.listen(els.newRepliesBtn, "click", () => {
      followStream = true;
      els.newRepliesBtn.hidden = true;
      // 流式进行中瞬时回底：平滑滚动会与每帧增高的内容互相拉扯
      scrollToBottom(!activeStream());
    });

    bindFollowLock();
  }

  /** 解除跟随锁定：用户显式向上阅读（滚轮上 / 上滑 / 翻页键 / 拖滚动条离开底部）。 */
  function releaseFollow() {
    followStream = false;
    if (followFrame) cancelAnimationFrame(followFrame);
    followFrame = 0;
    if (els && activeStream()) els.newRepliesBtn.hidden = false;
  }

  /**
   * 原生滚动输入期间不提交流式 Markdown。连续输入安静后立即补上最新快照，
   * 中间的网络 delta 仍完整累积在 stream.state，不会丢字。
   */
  function markUserScrollActive() {
    userScrollActive = true;
    if (followFrame) cancelAnimationFrame(followFrame);
    followFrame = 0;
    clearTimeout(scrollIdleTimer);
    scrollIdleTimer = scope.timeout(() => {
      scrollIdleTimer = 0;
      userScrollActive = false;
      for (const stream of [...streams.values()]) {
        if (stream.conversationId === state().activeConversationId && state().route.name === "chat") stream.scheduler.flush();
      }
    }, STREAM_SCROLL_IDLE_MS);
  }

  /**
   * 跟随锁定事件绑定：向上的用户手势才解除锁定；
   * 任何方式滚回贴近底部（惯性收尾 / 拖滚动条下压 / 手动滚回）自动重锁。
   */
  function bindFollowLock() {
    const scroller = els.messageScroll;

    scope.listen(scroller, "scroll", () => {
      const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      // 解锁跟随后产生的 scroll 只可能来自用户/惯性滚动；持续刷新 idle
      // 窗口，避免触控松手后的动量阶段重新开始 Markdown 绘制。
      if (scrollbarDragging || !followStream) markUserScrollActive();
      if (!followStream && distance <= FOLLOW_REENGAGE_PX) {
        followStream = true;
        els.newRepliesBtn.hidden = true;
      } else if (followStream && scrollbarDragging && distance > FOLLOW_RELEASE_PX) {
        followStream = false;
      }
    }, { passive: true });

    scope.listen(scroller, "wheel", (event) => {
      if (event.deltaY) markUserScrollActive();
      if (event.deltaY < 0) releaseFollow();
    }, { passive: true });

    scope.listen(scroller, "pointerdown", (event) => {
      const rect = scroller.getBoundingClientRect();
      scrollbarDragging = event.clientX >= rect.right - SCROLLBAR_HIT_PX && event.clientX <= rect.right;
      if (scrollbarDragging) markUserScrollActive();
    });
    scope.listen(window, "pointerup", () => {
      if (scrollbarDragging) markUserScrollActive();
      scrollbarDragging = false;
    });

    scope.listen(scroller, "touchstart", (event) => {
      lastTouchY = event.touches[0] ? event.touches[0].clientY : 0;
    }, { passive: true });
    scope.listen(scroller, "touchmove", (event) => {
      const touch = event.touches[0];
      const delta = touch ? touch.clientY - lastTouchY : 0;
      if (Math.abs(delta) > 1) markUserScrollActive();
      if (delta > 6) releaseFollow(); // 手指下移 = 向上翻阅
      lastTouchY = touch ? touch.clientY : lastTouchY;
    }, { passive: true });

    scope.listen(document, "keydown", (event) => {
      const target = event.target;
      if (target && target.closest && target.closest("input, textarea, select, button, a[href], [contenteditable='true']")) return;
      const scrollKeys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
      if (!scrollKeys.includes(event.key)) return;
      markUserScrollActive();
      if (event.key === "ArrowUp" || event.key === "PageUp" || event.key === "Home" || (event.key === " " && event.shiftKey)) {
        releaseFollow();
      }
    });
  }

  function autoGrow(input) {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }

  function scrollToBottom(smooth = false) {
    if (!els) return;
    if (followFrame) cancelAnimationFrame(followFrame);
    followFrame = 0;
    els.messageScroll.scrollTo({ top: els.messageScroll.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  /**
   * 打开会话后回底：首帧消息列仍按 content-visibility 估高布局，长消息尚未
   * 展开时 scrollHeight 可能还没有溢出，单帧滚动会落空并停留在列表顶部。
   * 连续数帧把滚动钉在底部，直到位置贴住（或用户上滚解除跟随）。
   */
  function settleFollowToBottom(conversationId) {
    const generation = ++settleFollowGeneration;
    let attempts = 0;
    let lastHeight = -1;
    const step = () => {
      if (
        !els ||
        generation !== settleFollowGeneration ||
        state().activeConversationId !== conversationId ||
        !followStream ||
        userScrollActive
      ) return;
      const scroller = els.messageScroll;
      const list = els.messageList;
      // 列表尚未提交首个内容帧时，“高度稳定且贴底”恰好成立，会误判为完成；
      // 先等消息节点出现（空会话根本不进入本函数），再开始判定。
      if (!list.children.length && attempts < 30) {
        attempts += 1;
        scope.frame(step);
        return;
      }
      scroller.scrollTop = scroller.scrollHeight;
      attempts += 1;
      const height = scroller.scrollHeight;
      const distance = height - scroller.scrollTop - scroller.clientHeight;
      // content-visibility 估高与字体加载会让列表高度在数帧内持续增长：
      // 高度稳定且已贴底才停止，用户上滚（解除跟随）立即让位。
      if ((height === lastHeight && distance <= 1) || attempts >= 60) return;
      lastHeight = height;
      scope.frame(step);
    };
    scope.frame(step);
  }

  /**
   * 流内容写入和 scrollHeight 读取拆到相邻帧，避免在同一帧强制同步布局；
   * 同时保证一帧最多只有一次程序回底，并可被用户上滚立即取消。
   */
  function scheduleFollowToBottom() {
    if (!els || followFrame || !followStream || userScrollActive) return;
    followFrame = scope.frame(() => {
      followFrame = 0;
      if (!els || !followStream || userScrollActive) return;
      els.messageScroll.scrollTop = els.messageScroll.scrollHeight;
    });
  }

  // ============ 渲染入口 ============

  function render(reason) {
    if (!els) renderChatSkeleton();
    commands?.synchronize();
    const conversation = activeConversation();
    const switched = conversation ? conversation.id !== render.lastConversationId : false;
    const previousId = switched ? render.lastConversationId : "";
    render.lastConversationId = conversation ? conversation.id : "";

    if (switched) {
      // 旧会话仍在等待 content-visibility 或字体布局稳定时，立即让其回底循环失效，
      // 避免覆盖新会话保存的流式阅读位置。
      settleFollowGeneration += 1;
      if (previousId && state().conversations.some((item) => item.id === previousId)) {
        state().pendingAttachmentsByConversation.set(previousId, state().pendingAttachments);
      }
      state().pendingAttachments = state().pendingAttachmentsByConversation.get(conversation.id) || [];
    }

    // 切换会话时收起弹层：锚点与内容都已失效
    if (switched) closeActivePopover();

    renderStageActions();
    // 响应中切走：记下该会话的阅读状态（跟随 / 滚动位置），切回时原样恢复
    const previousStream = previousId ? streamOf(previousId) : null;
    if (previousStream) {
      previousStream.view = { follow: followStream, scrollTop: els.messageScroll.scrollTop };
    }
    // stream-end 不再整列重建：finishStream 已原位重绘结束的消息节点
    if (switched || ["loaded", "conversation-created", "conversation-selected", "route", "boot"].includes(reason)) {
      renderMessages();
      restoreDraft(conversation);
      if (switched) {
        const liveStream = streamOf(conversation.id);
        if (liveStream && liveStream.view) {
          // 该会话仍在生成且留有阅读状态：回到原阅读位置，不强制回底
          followStream = liveStream.view.follow;
          els.newRepliesBtn.hidden = true;
          const savedTop = liveStream.view.scrollTop;
          scope.frame(() => { els.messageScroll.scrollTop = savedTop; });
        } else {
          followStream = true;
          els.newRepliesBtn.hidden = true;
          // 空会话没有可回底的内容：保持顶部，避免把空状态卡片钉到不可达位置。
          if (getActivePath(conversation).length) settleFollowToBottom(conversation.id);
        }
      }
    } else if (reason === "providers") {
      renderMessages();
    }
    renderComposerControls();
    renderChips();
  }
  render.lastConversationId = "";

  function restoreDraft(conversation) {
    if (!conversation || !els) return;
    const value = conversation.draft || "";
    if (els.composerInput.value !== value) {
      els.composerInput.value = value;
      autoGrow(els.composerInput);
    }
  }

  // ============ 工具条动作 ============

  function renderStageActions() {
    shell.stageActions.innerHTML = backendStatusHtml(state().backend);
  }

  // ============ 消息区 ============

  /** 按 DOM 数据属性查找消息条目，避免把可导入的消息 ID 拼进 CSS 选择器。 */
  function findMessageEntry(messageId) {
    if (!els?.messageList) return null;
    const target = String(messageId || "");
    return [...els.messageList.querySelectorAll(".message-entry[data-message-id]")]
      .find((entry) => entry.dataset.messageId === target) || null;
  }

  function renderMessages() {
    if (!els) return;
    const conversation = activeConversation();
    if (!conversation || !getActivePath(conversation).length) {
      renderEmptyStage();
      return;
    }
    els.messageList.dataset.conversationId = conversation.id;
    scope.frame(() => bindMessageEvents());
  }

  function renderEmptyStage() {
    // 空态没有消息列：清掉会话标记，让后续的单条追加回落到整列渲染
    delete els.messageList.dataset.conversationId;
  }

  /** 思维链开合：翻转面板并把状态记到消息上（切换会话整列重渲后原样恢复）。 */
  /** 压缩提示状态文案：压缩中实时态优先，重启后残留的 running 按完成展示。 */
  function compressNoticeText(message, conversationId) {
    const running = message.noticeState === "running" && compressingIds.has(conversationId);
    if (running) return "正在压缩上下文…";
    if (message.noticeState === "running") return "上下文压缩已中断";
    if (message.noticeState === "error") return "上下文压缩失败";
    return "上下文已压缩";
  }

  function growEditorTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 340)}px`;
  }

  function editorChipsOf(message) {
    return [
      ...(message.files || []).map((file) => chipHtml({ kind: "file", name: file.name, id: `file:${file.name}` })),
      ...(message.parts || []).filter((part) => part.type === "file").map((part, index) => chipHtml({ kind: "file", name: part.name || `文件 ${index + 1}`, id: `filepart:${index}` })),
      ...(message.parts || []).filter((part) => part.type === "image").map((part, index) => chipHtml({ kind: "image", name: part.alt || `图片 ${index + 1}`, source: part.source, id: `image:${index}` }))
    ].join("");
  }

  function renderEditorChips(entry, message) {
    const zone = entry.querySelector(".editor-chips");
    if (!zone) return;
    const chips = editorChipsOf(message);
    zone.innerHTML = chips;
    zone.hidden = !chips;
    bindEditorChipRemoves(entry, message.id);
    syncEditorResend(entry, message);
  }

  function editorHasContent(draft, text = draft?.content) {
    if (String(text || "").trim()) return true;
    if ((draft?.files || []).length) return true;
    return (draft?.parts || []).some((part) => part && ["image", "file"].includes(part.type));
  }

  function syncEditorResend(entry, draft, text = entry.querySelector(".editor-textarea")?.value) {
    const resend = entry.querySelector('[data-editor="resend"]');
    if (!resend) return;
    resend.disabled = !editorHasContent(draft, text);
  }

  function chipHtml({ kind, name, source, id }) {
    return [
      `<span class="attachment-chip${kind === "image" ? " image-chip iris-ring" : ""}" data-chip-id="${escapeAttr(id)}">`,
      kind === "image" && source ? `<img src="${escapeAttr(source)}" alt="" />` : icon("file", 13),
      `<span class="chip-name" title="${escapeAttr(name)}">${escapeHtml(name)}</span>`,
      `<button type="button" class="chip-remove" data-chip-remove aria-label="移除">${icon("close", 11)}</button>`,
      `</span>`
    ].join("");
  }

  function notifyCompressNotice(card) {
    const entry = card.closest("[data-message-id]");
    const conversation = activeConversation();
    const message = conversation && conversation.messages.find((item) => item.id === entry.dataset.messageId);
    if (!message || message.noticeKind !== "context-compress") return;
    const text = compressNoticeText(message, conversation.id).replace("…", "");
    toast(text, { tone: message.noticeState === "error" ? "danger" : "ok" });
  }

  function handleMessageAction(button) {
    const entry = button.closest("[data-message-id]");
    const messageId = entry.dataset.messageId;
    const action = button.dataset.messageAction;
    const conversation = activeConversation();
    if (action !== "copy" && !allowChange(conversation)) return;
    const index = conversation.messages.findIndex((message) => message.id === messageId);
    if (index < 0) return;
    if (action === "copy") copyMessage(conversation.messages[index]);
    if (action === "edit") startEditMessage(messageId);
    if (action === "branch") copyConversationFrom(conversation, messageId);
    if (action === "regenerate") regenerateFrom(conversation, index);
    if (action === "delete") deleteMessage(conversation, index);
  }

  function switchMessageBranch(button, forcedDirection = "") {
    const conversation = activeConversation();
    if (!allowChange(conversation)) return;
    const entry = button.closest("[data-message-id]");
    // Branch navigation only changes the visible path. It is safe while a
    // response is running because the stream remains keyed by conversation
    // and keeps reading in the background; destructive message actions stay
    // disabled separately by the renderer.
    if (!conversation || !entry) return;
    const messageId = entry.dataset.messageId;
    const activePath = getActivePath(conversation);
    const variants = getUserVariants(conversation, messageId, activePath);
    if (variants.total < 2 || variants.activeIndex < 0) return;
    const direction = forcedDirection || button.dataset.messageBranch;
    const nextIndex = variants.activeIndex + (direction === "previous" ? -1 : 1);
    const target = variants.messages[nextIndex];
    if (!target) return;

    if (!selectMessageVariant(conversation, target.id)) return;
    repairActiveSelections(conversation);
    const switchedPath = getActivePath(conversation);
    let commonLength = 0;
    while (
      commonLength < activePath.length &&
      commonLength < switchedPath.length &&
      activePath[commonLength].id === switchedPath[commonLength].id
    ) commonLength += 1;
    const changedIds = switchedPath.slice(commonLength).map((message) => message.id);

    // Keep the last common message anchored while React replaces the suffix.
    // When the root itself changes there is no shared previous node, so anchor
    // the incoming first node at the outgoing fork message's viewport position.
    const previous = entry.previousElementSibling;
    const anchorNode = previous || entry;
    const anchorId = previous?.dataset?.messageId || changedIds[0] || "";
    const anchorTop = anchorNode.getBoundingClientRect().top;
    store.persistSoon();
    const instantBranchIds = JSON.stringify(changedIds);
    // Branch navigation is a frequent reading action, so the replacement must
    // be visually instant. Mark the incoming suffix before React inserts it to
    // suppress the default message-in animation on its very first frame.
    if (changedIds.length) {
      els.messageList.dataset.instantBranchIds = instantBranchIds;
    }
    flushSync(() => store.notify("conversation-branch-switched", [
      `conversation:${conversation.id}`,
      `message:${conversation.id}:${messageId}`,
      "composer"
    ]));
    // MessageEntry captures the suppression flag for each newly mounted node.
    // Clear only the hand-off; the mounted suffix keeps its no-animation class
    // so later stream/store updates cannot expose and replay message-in.
    delete els.messageList.dataset.instantBranchIds;
    const liveStream = streamOf(conversation.id);
    const liveStreamIsVisible = Boolean(liveStream && getActivePath(conversation)
      .some((message) => message.id === liveStream.messageId));
    scope.frame(() => {
      if (!els) return;
      const nextAnchor = anchorId ? findMessageEntry(anchorId) : null;
      if (nextAnchor) els.messageScroll.scrollTop += nextAnchor.getBoundingClientRect().top - anchorTop;
      // React has committed the selected path by now. Re-apply the latest
      // registry snapshot only when the streaming assistant is on that path;
      // switching to another branch therefore never causes extra DOM work.
      if (liveStreamIsVisible && streams.get(conversation.id) === liveStream) liveStream.scheduler.flush();
    });
  }

  function openMessageImage(button) {
    const messageId = button.dataset.messageId;
    const imageIndex = Number(button.dataset.imageIndex);
    const conversation = activeConversation();
    const message = conversation.messages.find((item) => item.id === messageId);
    const part = message && (message.parts || []).filter((p) => p.type === "image" && p.source)[imageIndex];
    if (part) {
      openLightbox(part.source, part.alt);
      return;
    }
    // chat.output 到达后、消息终态持久化前也允许立即预览。
    const streamedImage = button.classList.contains("is-ready") ? button.querySelector("img") : null;
    if (streamedImage?.src) openLightbox(streamedImage.src, streamedImage.alt);
  }

  function downloadFilePart(part) {
    const source = String(part && part.source || "");
    if (!source) {
      toast("该文件数据不可用", { tone: "danger" });
      return;
    }
    if (/^https?:\/\//i.test(source)) {
      window.open(source, "_blank", "noopener");
      return;
    }
    try {
      downloadBlob(dataUrlBlob(source, part.mimeType), safeFilename(part.name || "文件"));
    } catch {
      toast("文件下载失败", { tone: "danger" });
    }
  }

  function resolveArtifactPart(button) {
    const conversation = activeConversation();
    if (!conversation) return null;
    const messageId = button.dataset.messageId;
    const message = conversation.messages.find((item) => item.id === messageId);
    const partIndex = Number(button.dataset.filePartsIndex);
    if (message && Number.isInteger(partIndex)) {
      const part = (message.parts || [])[partIndex];
      if (part?.type === "file") return part;
    }
    const artifactId = String(button.dataset.artifactId || "");
    if (message && artifactId) {
      const persisted = (message.parts || []).find((part) => part.type === "file" && part.artifactId === artifactId);
      if (persisted) return persisted;
    }
    const stream = streamOf(conversation.id);
    if (!stream || stream.messageId !== messageId || !artifactId) return null;
    return normalizeToolEvents(stream.state.toolEvents).files.find((part) => part.artifactId === artifactId) || null;
  }

  async function artifactSource(part) {
    if (!part || Number(part.size) > MAX_ARTIFACT_SOURCE_BYTES) {
      throw new Error("文件超过 2MB，无法在对话中打开源码");
    }
    const source = String(part.source || "");
    if (!source.startsWith("data:")) {
      throw new Error("远程文件仅支持下载，不会由预览器再次联网读取");
    }
    const blob = dataUrlBlob(source, part.mimeType);
    if (blob.size > MAX_ARTIFACT_SOURCE_BYTES) {
      throw new Error("文件超过 2MB，无法在对话中打开源码");
    }
    return blob.text();
  }

  async function handleArtifactAction(button) {
    const part = resolveArtifactPart(button);
    if (!part) {
      toast("该文件数据不可用", { tone: "danger" });
      return;
    }
    try {
      const source = await artifactSource(part);
      if (button.dataset.action === "artifact-run") {
        const format = button.dataset.previewKind === "svg" ? "svg" : "html";
        dialogs.previewHtml({ source, format, title: part.name || (format === "svg" ? "SVG 预览" : "HTML 预览") });
        return;
      }
      if (button.dataset.action === "artifact-copy") {
        const ok = await copyText(source);
        toast(ok ? "源码已复制" : "复制失败", { tone: ok ? "ok" : "danger" });
        return;
      }
      const card = button.closest(".artifact-file");
      const panel = card?.querySelector(".artifact-source-panel");
      const code = panel?.querySelector("code");
      if (!panel || !code) return;
      const expanded = panel.hidden;
      if (expanded && !code.dataset.loaded) {
        code.textContent = source;
        code.dataset.loaded = "true";
      }
      panel.hidden = !expanded;
      button.setAttribute("aria-expanded", String(expanded));
      button.title = expanded ? "收起源码" : "查看源码";
      button.setAttribute("aria-label", button.title);
    } catch (error) {
      toast(error instanceof Error ? error.message : "文件预览失败", { tone: "danger" });
    }
  }

  function handleFileDownload(button) {
    const part = resolveArtifactPart(button);
    if (part && part.type === "file") downloadFilePart(part);
  }

  /** 消息区常规交互统一委托到列表容器：整列重建或单条追加都无需重复绑定 O(n) 监听器。 */
  function bindMessageDelegation() {
    const list = els.messageList;
    scope.listen(list, "click", (event) => {
      const suggestion = event.target.closest("[data-suggestion]");
      if (suggestion) {
        els.composerInput.value = SUGGESTIONS[Number(suggestion.dataset.suggestion)];
        els.composerInput.dispatchEvent(new Event("input", { bubbles: true }));
        els.composerInput.focus();
        return;
      }
      const toggle = event.target.closest("[data-action='toggle-reasoning']");
      if (toggle) {
        const sheet = toggle.closest(".reasoning-sheet");
        if (sheet) {
          setReasoningSheetOpen(sheet, sheet.dataset.open !== "true");
          const entry = sheet.closest("[data-message-id]");
          const conversation = activeConversation();
          const message = conversation && entry &&
            conversation.messages.find((item) => item.id === entry.dataset.messageId);
          if (message) {
            message.reasoningOpen = sheet.dataset.open === "true";
            store.actions.patchMessage(conversation.id, message.id, {
              reasoningOpen: message.reasoningOpen
            });
            store.persistSoon();
          }
        }
        return;
      }
      const notice = event.target.closest("[data-notice]");
      if (notice) {
        notifyCompressNotice(notice);
        return;
      }
      const actionButton = event.target.closest("[data-message-action]");
      if (actionButton) {
        handleMessageAction(actionButton);
        return;
      }
      const branchButton = event.target.closest("[data-message-branch]");
      if (branchButton) {
        switchMessageBranch(branchButton);
        return;
      }
      const artifactAction = event.target.closest("[data-action^='artifact-']");
      if (artifactAction) {
        handleArtifactAction(artifactAction);
        return;
      }
      const downloadButton = event.target.closest(".file-download");
      if (downloadButton) {
        handleFileDownload(downloadButton);
        return;
      }
      const imageButton = event.target.closest(".message-image");
      if (imageButton) openMessageImage(imageButton);
    });
    scope.listen(list, "keydown", (event) => {
      const branchButton = event.target.closest ? event.target.closest("[data-message-branch]") : null;
      if (branchButton && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        switchMessageBranch(branchButton, event.key === "ArrowLeft" ? "previous" : "next");
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") return;
      const notice = event.target.closest ? event.target.closest("[data-notice]") : null;
      if (notice) {
        event.preventDefault();
        notifyCompressNotice(notice);
      }
    });
  }

  function bindMessageEvents(root = els.messageList) {
    // 思考开关、提示卡、消息操作与图片灯箱已委托到列表容器（见 bindMessageDelegation）；
    // 这里只保留编辑器专属绑定（输入、快捷键、拖放与附件选择）。
    const list = root;
    const editingEntry = list.matches(".message-entry.editing") ? list : list.querySelector(".message-entry.editing");
    if (editingEntry) bindEditorEvents(editingEntry);
  }

  function bindEditorChipRemoves(entry, messageId) {
    entry.querySelectorAll("[data-chip-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        const chip = button.closest("[data-chip-id]");
        const chipId = chip.dataset.chipId;
        const conversation = activeConversation();
        const message = conversation && conversation.messages.find((item) => item.id === messageId);
        const draft = editingDraft && editingDraft.id === messageId ? editingDraft : message;
        if (!message || !draft) return;
        if (chipId.startsWith("file:")) {
          const name = chipId.slice(5);
          draft.files = (draft.files || []).filter((file) => file.name !== name);
        } else if (chipId.startsWith("filepart:")) {
          const index = Number(chipId.slice(9));
          const files = (draft.parts || []).filter((part) => part.type === "file");
          const target = files[index];
          if (target) draft.parts = (draft.parts || []).filter((part) => part !== target);
        } else {
          const index = Number(chipId.slice(6));
          const images = (draft.parts || []).filter((part) => part.type === "image");
          const target = images[index];
          if (target) draft.parts = (draft.parts || []).filter((part) => part !== target);
        }
        renderEditorChips(entry, draft);
      });
    });
  }

  function bindEditorEvents(entry) {
    const editor = entry.querySelector(".message-editor");
    if (!editor) return;
    const messageId = entry.dataset.messageId;
    const conversation = activeConversation();
    const message = conversation && conversation.messages.find((item) => item.id === messageId);
    if (!message) return;
    const isUser = message.role === "user";
    const textarea = editor.querySelector(".editor-textarea");

    renderEditorChips(entry, editingDraft && editingDraft.id === messageId ? editingDraft : message);
    growEditorTextarea(textarea);
    textarea.addEventListener("input", () => {
      growEditorTextarea(textarea);
      syncEditorResend(entry, editingDraft && editingDraft.id === messageId ? editingDraft : message, textarea.value);
    });
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finishEdit(messageId, "cancel", textarea.value);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        finishEdit(messageId, isUser ? "resend" : "save", textarea.value);
      }
    });

    editor.querySelectorAll("[data-editor]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.editor;
        if (mode === "attach") return; // 附件入口单独绑定
        finishEdit(messageId, mode, textarea.value);
      });
    });

    if (!isUser) return;
    const fileInput = entry.querySelector(".editor-file-input");
    const attachBtn = editor.querySelector('[data-editor="attach"]');
    if (attachBtn && fileInput) {
      attachBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", async () => {
        if (fileInput.files.length) await handleEditorFiles(entry, messageId, fileInput.files);
        fileInput.value = "";
      });
    }
    // 拖拽上传与输入区同款
    ["dragenter", "dragover"].forEach((type) => {
      editor.addEventListener(type, (event) => {
        event.preventDefault();
        editor.classList.add("drag-over");
      });
    });
    ["dragleave", "drop"].forEach((type) => {
      editor.addEventListener(type, (event) => {
        event.preventDefault();
        editor.classList.remove("drag-over");
      });
    });
    editor.addEventListener("drop", (event) => {
      if (event.dataTransfer && event.dataTransfer.files.length) {
        handleEditorFiles(entry, messageId, event.dataTransfer.files);
      }
    });
  }

  /** 只重绘单条消息节点：原位编辑的开关不牵动整列（滚动与其余消息 DOM 保持不动）。 */
  function replaceMessageEntry(conversation, index) {
    if (!els) return null;
    const message = conversation.messages[index];
    if (!message) return null;
    flushSync(() => store.notify("message-updated", [
      `conversation:${conversation.id}`,
      `message:${conversation.id}:${message.id}`,
      "composer"
    ]));
    const entry = findMessageEntry(message.id);
    if (!entry) return null;
    bindMessageEvents(entry);
    return entry;
  }

  /** 追加单条消息节点（发送后的助手占位）：不重建整列，长对话发送不再出现整列重绘停顿。 */
  function appendMessageEntry(conversation, message) {
    if (!els) return false;
    if (els.messageList.dataset.conversationId !== conversation.id) return false;
    const index = conversation.messages.indexOf(message);
    if (index < 0) return false;
    flushSync(() => store.notify("conversation-updated", [
      `conversation:${conversation.id}`,
      `message:${conversation.id}:${message.id}`
    ]));
    const entry = findMessageEntry(message.id);
    if (!entry) return false;
    bindMessageEvents(entry);
    return true;
  }

  function startEditMessage(messageId) {
    const conversation = activeConversation();
    if (!allowChange(conversation)) return;
    if (!conversation) return;
    if (streamOf(conversation.id)) {
      toast("本对话生成中暂不能编辑，请先停止或等待完成", { tone: "danger" });
      return;
    }
    const index = conversation.messages.findIndex((message) => message.id === messageId);
    if (index < 0) return;
    // 同时只保留一个编辑器：先前打开的原位还原（不写回修改）
    if (editingMessageId && editingMessageId !== messageId) {
      const prevIndex = conversation.messages.findIndex((message) => message.id === editingMessageId);
      editingMessageId = "";
      editingDraft = null;
      if (prevIndex >= 0) replaceMessageEntry(conversation, prevIndex);
    }
    editingMessageId = messageId;
    editingDraft = JSON.parse(JSON.stringify(conversation.messages[index]));
    state().editingMessage = { conversationId: conversation.id, messageId };
    const entry = replaceMessageEntry(conversation, index);
    const textarea = entry && entry.querySelector(".editor-textarea");
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      growEditorTextarea(textarea);
    }
  }

  function finishEdit(messageId, mode, text) {
    const conversation = activeConversation();
    if (!allowChange(conversation)) return;
    if (!conversation) return;
    const index = conversation.messages.findIndex((message) => message.id === messageId);
    if (index < 0) return;
    const message = conversation.messages[index];
    const draft = editingDraft && editingDraft.id === messageId ? editingDraft : JSON.parse(JSON.stringify(message));
    if (mode === "resend" && message.role === "user" && !editorHasContent(draft, text)) return;
    editingMessageId = "";
    state().editingMessage = null;
    editingDraft = null;

    // 取消 = 什么都不写回，原位还原消息
    if (mode === "cancel") {
      replaceMessageEntry(conversation, index);
      return;
    }
    if (mode === "resend" && message.role === "user") {
      draft.content = text.slice(0, LIMITS.messageChars);
      const forked = forkUserMessage(conversation, messageId, {
        content: draft.content,
        files: draft.files || [],
        parts: draft.parts || []
      });
      if (!forked) {
        replaceMessageEntry(conversation, index);
        return;
      }
      // Keep the single session-level summary even when this fork no longer
      // contains its boundary. getValidContextCompression() makes the summary
      // inactive for the new path while allowing it to become valid again when
      // the user switches back to the original branch.
      store.touchConversation(conversation);
      renderMessages();
      startStream(conversation);
      return;
    }
    message.content = text.slice(0, LIMITS.messageChars);
    const editedPath = getActivePath(conversation);
    const editedIndex = editedPath.findIndex((item) => item.id === messageId);
    invalidateCompressionForIndex(conversation, editedIndex);
    // 助手正文变化后，该消息及后续响应的 provider usage 都基于旧上下文，
    // 不能继续作为精确快照；保留数字用于消息元数据，但上下文计算改走估算。
    if (message.role === "assistant" && editedIndex >= 0) {
      editedPath.slice(editedIndex).forEach((item) => {
        if (item.usage) item.usage.estimated = true;
      });
    }
    store.touchConversation(conversation);
    store.persistSoon();
    replaceMessageEntry(conversation, index);
    renderComposerControls(); // 编辑改动上下文估算：圆环与摘要原位跟进
    toast("已保存", { tone: "ok" });
  }

  async function copyMessage(message) {
    const parts = [];
    if (message.reasoning) parts.push(`【思考过程】\n${message.reasoning}`);
    if (message.content) parts.push(message.content);
    (message.parts || []).filter((part) => part.type === "tool_result" || part.type === "skill_applied").forEach((part) => {
      const source = part.name === "clawbox_code_interpreter" ? "代码解释器"
        : part.type === "skill_applied" || part.source === "skill" ? "Skill"
          : part.source === "sandbox" ? "沙箱" : "工具";
      const output = part.type === "skill_applied" ? "已应用" : part.output || "";
      parts.push(`【${source}：${part.name || "未命名"}】\n${output}`);
    });
    const ok = await copyText(parts.join("\n\n———\n\n"));
    toast(ok ? "已复制到剪贴板" : "复制失败", { tone: ok ? "ok" : "danger" });
  }

  function copyConversationFrom(conversation, messageId) {
    if (!allowChange(conversation)) return;
    const visiblePrefix = flattenVisiblePrefix(conversation, messageId);
    if (!visiblePrefix.length) return;
    const branch = JSON.parse(JSON.stringify({
      ...conversation,
      messages: visiblePrefix,
      activeRootMessageId: visiblePrefix[0]?.id || "",
      activeChildByMessageId: Object.fromEntries(visiblePrefix.slice(0, -1).map((message, index) => [message.id, visiblePrefix[index + 1].id]))
    }));
    branch.id = `${conversation.id}-copy-${Date.now().toString(36)}`;
    branch.title = truncateText(`${conversation.title || "未命名对话"} · 副本`, 60);
    branch.pinned = false;
    branch.titleGenerationAttempted = true;
    delete branch.firstResponsePending;
    branch.contextCompression = null;
    branch.draft = "";
    branch.createdAt = Date.now();
    branch.updatedAt = Date.now();
    branch.messages.forEach((message) => {
      if (message.usage) message.usage.estimated = true;
    });
    state().conversations = sortConversations([branch, ...state().conversations]);
    state().activeConversationId = branch.id;
    store.persistSoon();
    store.notify("conversation-selected");
    toast("已复制到新对话", { tone: "ok" });
  }

  async function deleteMessage(conversation, index) {
    if (!allowChange(conversation)) return;
    const message = conversation.messages[index];
    if (!message) return;
    const activePath = getActivePath(conversation);
    const activeIndex = activePath.findIndex((item) => item.id === message.id);
    const siblingCandidates = conversation.messages
      .filter((item) => item.parentId === message.parentId && item.role === message.role && item.id !== message.id)
      .sort((a, b) => conversation.messages.indexOf(a) - conversation.messages.indexOf(b));
    const siblingIndex = conversation.messages
      .filter((item) => item.parentId === message.parentId && item.role === message.role)
      .sort((a, b) => conversation.messages.indexOf(a) - conversation.messages.indexOf(b))
      .findIndex((item) => item.id === message.id);
    const fallback = siblingIndex > 0 ? siblingCandidates[siblingIndex - 1] : siblingCandidates[0];
    const subtreeSize = getMessageSubtreeIds(conversation, message.id).size;
    const ok = await dialogs.confirm({
      title: "删除消息",
      message: `${subtreeSize > 1 ? `这条消息及其 ${subtreeSize - 1} 条后续消息` : "这条消息"}将从当前分支移除；如果它属于共享前缀，所有后续分支都会受到影响。压缩摘要可能一并失效。`,
      confirmLabel: "删除",
      danger: true
    });
    if (!ok || !allowChange(conversation)) return;
    const removedIds = removeMessageSubtree(conversation, message.id);
    if (!removedIds.length) return;
    if (fallback && !removedIds.includes(fallback.id)) selectMessageVariant(conversation, fallback.id);
    repairActiveSelections(conversation);
    if (conversation.contextCompression && removedIds.includes(conversation.contextCompression.throughMessageId)) {
      conversation.contextCompression = null;
    } else if (activeIndex >= 0) {
      invalidateCompressionForIndex(conversation, activeIndex);
    }
    store.touchConversation(conversation);
    store.notify("conversation-updated");
    renderMessages();
    toast("消息已删除");
  }

  function regenerateFrom(conversation, index) {
    if (!allowChange(conversation)) return;
    if (streamOf(conversation.id)) {
      toast("本对话正在生成回复", { tone: "danger" });
      return;
    }
    const message = conversation.messages[index];
    if (!message) return;
    if (message.role !== "assistant") return;
    const parent = message.parentId == null ? null : conversation.messages.find((item) => item.id === message.parentId);
    if (!parent || parent.role !== "user") return;
    const removedIds = removeMessageSubtree(conversation, message.id);
    repairActiveSelections(conversation);
    if (conversation.contextCompression && removedIds.includes(conversation.contextCompression.throughMessageId)) {
      conversation.contextCompression = null;
    }
    store.touchConversation(conversation);
    store.notify("conversation-updated");
    renderMessages();
    startStream(conversation);
  }

  // ============ 附件 ============

  async function handleFiles(fileList) {
    const conversation = activeConversation();
    if (!conversation) return;
    const pending = state().pendingAttachments;
    const items = await collectAttachmentItems(fileList, createAttachmentBudget(pending), toast);
    if (items.length) pending.push(...items);
    renderChips();
    refreshSendButton();
  }

  /** 编辑器内新增附件：直接并入正在编辑的消息（与输入区共用限额管线）。 */
  async function handleEditorFiles(entry, messageId, fileList) {
    const conversation = activeConversation();
    const message = conversation && conversation.messages.find((item) => item.id === messageId);
    const draft = editingDraft && editingDraft.id === messageId ? editingDraft : message;
    if (!message || !draft) return;
    // 消息上只存了文本 / data URL，用长度折算既有用量
    const items = await collectAttachmentItems(fileList, createMessageAttachmentBudget(draft), toast);
    if (!items.length) return;
    draft.files = [...(draft.files || [])];
    draft.parts = [...(draft.parts || [])];
    for (const item of items) {
      if (item.kind === "image") {
        draft.parts.push({ type: "image", source: item.source, mimeType: item.mimeType, alt: item.name });
      } else if (item.kind === "media") {
        draft.parts.push({ type: "file", name: item.name, mimeType: item.mimeType, source: item.source, size: item.size });
      } else {
        draft.files.push({ name: item.name, text: item.text });
      }
    }
    renderEditorChips(entry, draft);
  }

  function renderChips() {
    if (!els) return;
    const pending = state().pendingAttachments;
    els.composerChips.hidden = !pending.length;
    els.composerChips.innerHTML = pending.map((item) => chipHtml({
      kind: item.kind,
      name: item.name,
      source: item.source,
      id: item.id
    })).join("");
    els.composerChips.querySelectorAll("[data-chip-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.closest("[data-chip-id]").dataset.chipId;
        state().pendingAttachments = state().pendingAttachments.filter((item) => item.id !== id);
        renderChips();
        refreshSendButton();
      });
    });
  }

  // ============ 发送与流式管线 ============

  function composerPayload() {
    const text = els.composerInput.value.trim();
    const pending = state().pendingAttachments;
    return { text, pending, hasContent: Boolean(text || pending.length) };
  }

  function refreshSendButton() {
    if (!els) return;
    if (activeStream()) {
      els.sendBtn.classList.add("stop-mode");
      els.sendBtn.title = "停止生成";
      els.sendBtn.setAttribute("aria-label", "停止生成");
      els.sendBtn.innerHTML = icon("stop", 16);
      els.sendBtn.disabled = false;
      return;
    }
    els.sendBtn.classList.remove("stop-mode");
    els.sendBtn.title = "发送";
    els.sendBtn.setAttribute("aria-label", "发送");
    els.sendBtn.innerHTML = icon("send", 17);
    if (commands?.isCommand()) { els.sendBtn.disabled = !state().loaded; return; }
    const { hasContent } = composerPayload();
    const conversation = activeConversation();
    const provider = conversation ? conversationProvider(conversation) : null;
    els.sendBtn.disabled = !hasContent || Boolean(conversation && (
      compressingIds.has(conversation.id) ||
      !provider ||
      (provider && provider.enabled === false) ||
      (provider && conversation.model && !provider.models.includes(conversation.model))
    ));
  }

  function renderComposerControls() {
    if (!els) return;
    els.composerInput.disabled = !state().loaded;
    const conversation = activeConversation();
    const locked = isConversationLocked(conversation);
    els.runtimeBtn.disabled = locked;
    els.runtimeBtn.title = locked ? FIRST_RESPONSE_LOCK_REASON : "模型与思考强度";
    const projectButton = document.getElementById("projectSelectorBtn");
    if (projectButton) { projectButton.disabled = locked; projectButton.title = locked ? FIRST_RESPONSE_LOCK_REASON : "选择项目"; }
    const model = conversation ? conversation.model : "";
    els.modelValue.textContent = model || "未选择";
    const level = effortLevelOf(conversation ? resolveChatConfig(state(), conversation).reasoningEffort : DEFAULT_EFFORT);
    els.effortValue.textContent = level.label;
    refreshContextRing();
    refreshSendButton();
  }

  /** 常驻圆环：只改弧线偏移与可访问名称，不重建 SVG。 */
  function requestContextUsage(conversation, request, draft = null) {
    const modelConfig = resolveEffectiveModelConfig(request.provider, request.model);
    return computeContextUsage(conversation, request.provider ? modelConfig.contextWindow : contextWindowOf(conversation), {
      config: { ...request.config, systemPrompt: request.baseSystemPrompt },
      fixedContext: request.fixedContext,
      contextErrors: request.contextErrors,
      draft,
      maxTokens: modelConfig.maxTokens,
      extensions: request.extensions
    });
  }

  function composerContextUsage(conversation) {
    const request = resolveRequestParts(conversation);
    const { text, pending } = composerPayload();
    const parsed = parseCommandInput(text);
    const draft = (text || pending.length) && parsed.kind !== 'command' ? { role: 'user', content: parsed.text,
      files: pending.filter(item => item.kind === 'file').map(item => ({ name: item.name, text: item.text })),
      parts: pending.filter(item => item.kind !== 'file').map(item => ({ type: item.kind === 'image' ? 'image' : 'file', source: item.source, size: item.size })) } : null;
    return requestContextUsage(conversation, request, draft);
  }

  function refreshContextRing() {
    if (!els || !els.usageRing) return;
    const conversation = activeConversation();
    const usage = conversation ? composerContextUsage(conversation) : null;
    const percent = usage ? usage.percent : 0;
    els.usageRing.style.strokeDashoffset = String(100 - percent * 100);
    const percentText = Math.round(percent * 100);
    const isCompressing = Boolean(conversation && compressingIds.has(conversation.id));
    els.usageRing.style.opacity = isCompressing ? "0.45" : "";
    els.usageBtn.setAttribute("aria-label", isCompressing ? "正在压缩上下文" : `压缩上下文（已用约 ${percentText}%）`);
    els.usageBtn.setAttribute("aria-busy", isCompressing ? "true" : "false");
    els.usageBtn.classList.toggle("is-compressing", isCompressing);
    if (contextTooltipEl && contextTooltipEl.classList.contains("is-open") && usage) {
      contextTooltipEl.innerHTML = contextTooltipLinesMarkup(usage);
    }
  }

  async function submitComposer() {
    if (commands?.isCommand()) { await commands.submit(); return; }
    const conversation = activeConversation();
    if (!conversation) return;
    if (streamOf(conversation.id)) {
      toast("本对话正在生成回复，请先停止或等待完成", { tone: "danger" });
      return;
    }
    if (compressingIds.has(conversation.id) || preparingIds.has(conversation.id)) {
      toast("正在准备或压缩上下文，请稍候", { tone: "danger" });
      return;
    }
    const { text: rawText, pending, hasContent } = composerPayload();
    const text = parseCommandInput(rawText).text;
    if (!hasContent) return;

    const provider = conversationProvider(conversation);
    if (!provider) {
      toast(conversation.providerSnapshot
        ? "当前供应商已被删除，请重新选择可用模型"
        : "请先在设置中配置供应商", { tone: "danger" });
      return;
    }
    if (provider?.enabled === false) {
      toast("当前供应商已禁用，请重新选择可用模型", { tone: "danger" });
      return;
    }
    if (provider && !provider.models.includes(conversation.model)) {
      toast("当前模型已从供应商配置中移除，请重新选择模型", { tone: "danger" });
      return;
    }
    if (!conversation.model) {
      toast("请先选择模型", { tone: "danger" });
      return;
    }
    const images = pending.filter((item) => item.kind === "image");
    const media = pending.filter((item) => item.kind === "media");
    if (images.length && capabilityOf(conversation, "visionInput") === false) {
      toast("当前模型声明不支持看图（能力设为关闭）；图片已保留在输入区", { tone: "danger" });
      return;
    }

    const userMessage = {
      id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      content: text.slice(0, LIMITS.messageChars),
      files: pending.filter((item) => item.kind === "file").map((item) => ({ name: item.name, text: item.text })),
      parts: [
        ...images.map((item) => ({ type: "image", source: item.source, mimeType: item.mimeType, alt: item.name })),
        ...media.map((item) => ({ type: "file", name: item.name, mimeType: item.mimeType, source: item.source, size: item.size }))
      ],
      createdAt: Date.now()
    };
    const config = resolveChatConfig(state(), conversation);
    const request = captureRequest(conversation, config);
    if (!(await prepareContext(conversation, config, userMessage, request))) return;
    // A compression request may outlive a navigation or further typing. Never erase newer input.
    if (scope.disposed || activeConversation()?.id !== conversation.id || state().route.name !== "chat" || composerPayload().text !== rawText || JSON.stringify(state().pendingAttachments) !== JSON.stringify(pending)) {
      toast("输入或会话已变化，内容已保留，请再次发送。", { tone: "danger" });
      return;
    }
    const firstResponse = beginFirstResponse(conversation);
    const titleInput = firstInputDescription(userMessage, pending);
    if (firstResponse && !conversation.title) conversation.title = truncateText(titleInput, LIMITS.titleLength);
    conversation.draft = "";
    state().pendingAttachments = [];
    els.composerInput.value = "";
    autoGrow(els.composerInput);
    store.actions.appendMessage(conversation.id, userMessage);
    store.touchConversation(conversation);

    closeActivePopover();
    void startStream(conversation, config, true, request);
    if (firstResponse) void titleGeneration.generate(conversation, titleInput, request.titleTarget);
  }

  const requestMessages = contextMessages;

  function captureRequest(conversation, config = resolveChatConfig(state(), conversation)) {
    return structuredClone(resolveRequestParts(conversation, config));
  }
  function resolveRequestParts(conversation, config = resolveChatConfig(state(), conversation)) {
    const provider = conversationProvider(conversation);
    const contexts = (requestContexts?.list() || []).map(entry => {
      try { return entry.capture({ state: state(), conversation }); }
      catch { return { text: '', error: '固定上下文读取失败，请检查项目资料后重试。' }; }
    });
    const fixedContext = contexts.map(entry => entry.text).join('');
    return {
      fixedContext, contextErrors: contexts.map(entry => entry.error).filter(Boolean),
      baseSystemPrompt: config.systemPrompt,
      provider, header: providerHeader(conversation), model: conversation.model,
      compressionTarget: captureAuxiliaryModel(state(), config.compressionModel, provider, conversation.model),
      titleTarget: captureAuxiliaryModel(state(), config.titleModel, provider, conversation.model),
      config: { ...config, systemPrompt: (config.systemPrompt || "") + fixedContext }, projectId: conversation.projectId, extensions: enabledExtensions(state().extensions),
      imageOutput: capabilityOf(conversation, "imageOutput") === true
    };
  }

  const preparingIds = new Set();
  function contextEstimate(conversation, config, extra = null, request = captureRequest(conversation, config)) {
    return requestContextUsage(conversation, request, extra).used;
  }
  async function prepareContext(conversation, config, extra = null, request = captureRequest(conversation, config)) {
    config = request.config;
    if (preparingIds.has(conversation.id)) return false;
    preparingIds.add(conversation.id);
    const projectId = conversation.projectId;
    try {
      const provider = request.provider;
      if (!provider || provider.enabled === false || !provider.models.includes(request.model)) throw new Error("请选择可用模型后重试。");
      const budget = resolveInputBudget(resolveEffectiveModelConfig(provider, request.model), config);
      if (request.contextErrors.length) throw new Error(request.contextErrors.join(' '));
      const pending = extra || requestMessages(conversation).filter(message => message.role === 'user').at(-1);
      const fixed = estimateContextTokens({ systemPrompt: request.config.systemPrompt, messages: pending ? [pending] : [], extensions: request.extensions });
      if (fixed > budget) throw new Error('固定资料、系统提示词与本次输入已超过输入预算；请精简资料或选择更大窗口的模型。资料不会被压缩或截断。');
      if (scope.disposed) return false;
      if (conversation.projectId !== projectId) throw new Error("项目已变化，请重新发送。");
      if (contextEstimate(conversation, config, extra, request) > budget) throw new Error("上下文超过输入预算；内容已保留，请手动压缩历史、精简输入或选择更大窗口的模型后重试。");
      return true;
    } catch (error) {
      toast(error.message, { tone: "danger" });
      return false;
    } finally { preparingIds.delete(conversation.id); }
  }
  async function startStream(conversation, config = resolveChatConfig(state(), conversation), prepared = false, request = captureRequest(conversation, config)) {
    if (streams.has(conversation.id)) return;
    if (!prepared && !(await prepareContext(conversation, config, null, request))) return;
    const provider = request.provider;
    const streamEnabled = request.config.streaming;

    const assistantMessage = {
      id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      role: "assistant",
      content: "",
      reasoning: "",
      reasoningKind: "thinking",
      parts: [],
      files: [],
      createdAt: Date.now(),
      durationMs: 0,
      reasoningMs: 0
    };
    appendToActivePath(conversation, assistantMessage);
    // 只追加占位节点：整列重建会让长对话在每次发送时出现可感知停顿
    if (!appendMessageEntry(conversation, assistantMessage)) {
      renderMessages();
    }
    followStream = true;
    scope.frame(() => scrollToBottom());

    const format = provider ? provider.responseFormat : (conversation.providerSnapshot && conversation.providerSnapshot.responseFormat) || "openai-compatible";
    const stream = streams.create(conversation.id, assistantMessage.id, format);
    store.actions.startStream(conversation.id);
    const { controller } = stream;
    let acc = stream.state;
    Object.assign(stream, {
      startedAt: Date.now(),
      contentStartedAt: 0,
      reasoningAutoCollapsed: false,
      expectsImage: request.imageOutput,
      request,
      placeholder: assistantMessage
    });
    // 思考计时不能依赖数据帧到达（长思考期间可能长时间无输出），用定时器驱动刷新
    stream.timer = window.setInterval(() => schedulePaint(stream), 500);
    document.body.classList.add("is-streaming");
    renderComposerControls();
    setStreamingPlaceholder(assistantMessage, stream);
    // 发送流程后段与 store 通知触发的调度式列表重渲会抹掉刚挂的等待态：
    // 把补挂载排进 setTimeout(0)，落在 React 经 MessageChannel 的批量提交之后，
    // 不必等 500ms 心跳才发现转圈消失。
    setTimeout(() => schedulePaint(stream), 0);

    try {
      const response = await apiFetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          provider: request.header,
          model: request.model,
          reasoningEffort: request.config.reasoningEffort,
          chatConfig: { ...request.config, inputBudget: null, version: 1 },
          stream: streamEnabled,
          contextSummary: (getValidContextCompression(conversation) || {}).compression?.summary || "",
          extensions: request.extensions,
          messages: requestMessages(conversation).filter((message) => !(message.role === "assistant" && !message.content))
        })
      });

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const payload = await response.json();
          detail = payload.error || detail;
        } catch { /* 保留状态码 */ }
        throw new Error(detail);
      }

      if (!streamEnabled || !(response.headers.get("content-type") || "").includes("text/event-stream")) {
        const payload = await response.json();
        const normalized = normalizeProviderResponse(payload, acc.format);
        acc = {
          ...acc,
          status: "completed",
          reasoning: normalized.reasoning,
          content: normalized.content,
          images: normalized.images,
          files: normalized.files,
          skippedAttachments: normalized.skippedAttachments || [],
          usage: normalized.usage,
          reasoningKind: normalized.reasoningKind,
          toolEvents: normalized.toolEvents || [],
          completed: true,
          completedAt: Date.now()
        };
        stream.state = acc;
        paint(stream);
        return;
      }

      if (!response.body || typeof response.body.getReader !== "function") {
        throw new Error("服务器返回的流不可读取");
      }
      await readSseStream(response.body, {
        signal: controller.signal,
        onFrame(frame) {
          streamMetric("networkEvents");
          const previousImageCount = acc.images.length;
          acc = consumeAppStreamFrame(acc, frame);
          stream.state = acc;
          // 图片事件频率极低，立即启动解码；正文 delta 仍按 scheduler 合帧。
          if (acc.images.length > previousImageCount) paint(stream);
          else schedulePaint(stream);
        }
      });
      acc = finalizeAppStreamState(acc);
      stream.state = acc;
      schedulePaint(stream);
    } catch (error) {
      const aborted = controller.signal.aborted || (error && error.name === "AbortError");
      acc = {
        ...acc,
        error: acc.error || (aborted ? "" : error.message),
        stopped: aborted || acc.stopped
      };
      acc = finalizeAppStreamState(acc);
      stream.state = acc;
      paint(stream);
      return;
    } finally {
      finishStream(conversation);
    }
  }

  function setStreamingPlaceholder(message, stream) {
    const entry = findMessageEntry(message.id);
    if (!entry) return;
    mountStreamingChrome(entry, stream);
  }

  function mountReasoningSheet(entry) {
    let sheet = entry.querySelector(".reasoning-sheet");
    if (sheet) return sheet;
    const head = entry.querySelector(".assistant-head");
    if (!head) return null;
    sheet = document.createElement("div");
    sheet.className = "reasoning-sheet";
    sheet.dataset.open = "true";
    sheet.innerHTML = reasoningStreamingHtml(entry.dataset.messageId);
    head.after(sheet);
    return sheet;
  }

  function responsePendingHtml(label, elapsedMs = 0) {
    const elapsed = elapsedMs > 0 ? ` · ${formatDuration(elapsedMs)}` : "";
    return `<span class="response-spinner" aria-hidden="true"></span><span class="response-pending-label">${label}${elapsed}</span>`;
  }

  /**
   * 等待态只更新文本节点，不重建转圈元素：meta innerHTML 重建会让
   * .response-spinner 的 CSS 旋转动画从 0° 重启（每 500ms 两次），视觉上卡顿。
   * 仅在转圈节点不存在（消息列表重建后重挂载）时才整体重建。
   */
  function paintPendingMeta(meta, status, elapsedMs) {
    if (!meta.querySelector(".response-spinner") || !meta.querySelector(".response-pending-label")) {
      meta.innerHTML = responsePendingHtml(status, elapsedMs);
      return;
    }
    const next = elapsedMs > 0 ? `${status} · ${formatDuration(elapsedMs)}` : status;
    const label = meta.querySelector(".response-pending-label");
    if (label.textContent !== next) label.textContent = next;
  }

  /** 补上流式等待态；只有收到真实 reasoning 后才挂载思考面板。 */
  function mountStreamingChrome(entry, stream) {
    const imageMode = stream?.expectsImage === true;
    const streamState = stream?.state;
    const answerStarted = Boolean(streamState?.content) || streamState?.phase === "answering" || streamState?.phase === "completed";
    const reasoningStarted = Boolean(streamState?.reasoning);
    entry.classList.toggle("is-generating-image", imageMode);
    entry.classList.toggle("is-response-pending", !imageMode && !answerStarted);
    if (imageMode) mountImageGenerationSlot(entry, entry.dataset.messageId);
    if (reasoningStarted) mountReasoningSheet(entry);
    const meta = entry.querySelector(".message-meta");
    if (meta && !answerStarted) {
      const label = imageMode ? "正在生成图片" : reasoningStarted ? "正在思考" : "等待响应";
      paintPendingMeta(meta, label, 0);
    }
  }

  function reasoningStreamingHtml(messageId) {
    const bodyId = reasoningBodyId(messageId);
    return [
      `<button type="button" class="reasoning-toggle" data-action="toggle-reasoning" aria-expanded="true" aria-controls="${bodyId}">`,
      `<span class="reasoning-mark">${icon("leaf", 16, "reasoning-icon")}</span>`,
      `<span class="reasoning-label">正在思考…</span>`,
      `<span class="reasoning-duration"></span>`,
      `<span class="chevron">${icon("chevronRight", 13)}</span>`,
      `</button>`,
      `<div class="reasoning-content"><div class="reasoning-clip"><div id="${bodyId}" class="reasoning-body markdown-body"></div></div></div>`
    ].join("");
  }

  function schedulePaint(stream) {
    if (!stream) return;
    stream.scheduler.schedule();
  }

  /**
   * 流式正文重绘：内容未变化则跳过；未完成帧距上次重绘不足 STREAM_BODY_PAINT_MS 时合帧；
   * 用户上滚阅读且流式条目已在视口下方时暂停重绘（数据仍实时同步，滚回时补齐）。
   * 完成帧始终重绘，保证最终内容完整落进 DOM。
   */
  function paintStreamBody(stream, node, content) {
    // 版本号用完整内容而非长度：等长改写（如链接注入后原位置变化）也会被识别为重绘
    stream.paintedMarkdown ||= new WeakMap();
    if (stream.paintedMarkdown.get(node) === content) return;
    if (!stream.state.completed) {
      const now = performance.now();
      if (now - (stream.lastBodyPaintAt || 0) < (stream.markdownDelay || STREAM_BODY_PAINT_MS)) return;
      if (!followStream && node.getBoundingClientRect().top > window.innerHeight + STREAM_VIEWPORT_LEAD_PX) return;
    }
    const renderStartedAt = performance.now();
    node.innerHTML = renderMarkdown(content);
    streamMetric("markdownRenders");
    streamMetric("domCommits");
    const renderDuration = performance.now() - renderStartedAt;
    stream.paintedMarkdown.set(node, content);
    stream.lastBodyPaintAt = performance.now();
    stream.markdownDelay = stream.scheduler.markdownDelay(renderDuration);
  }

  /** 工具按首次出现的正文锚点穿插；同 callId 的后续状态只更新原位置。 */
  function paintStreamFlow(stream, entry, content, events) {
    // content delta 不会改变 events 数组引用；缓存归一化结果，避免大文件 data URL
    // 在后续每个正文刷新帧重复校验与扫描。
    if (stream.normalizedToolEventsSource !== events) {
      stream.normalizedToolEventsSource = events;
      stream.normalizedToolEvents = normalizeToolEvents(events);
    }
    const runtime = stream.normalizedToolEvents || { parts: [], files: [] };
    const parts = runtime.parts;
    let flow = entry.querySelector(":scope > .message-body > .assistant-flow");
    const structureChanged = stream.paintedToolEvents !== events || stream.paintedFlowEntry !== entry || !flow;
    if (structureChanged) {
      const openStates = new Map([...entry.querySelectorAll(".tool-result[data-call-id]")]
        .map((node) => [node.dataset.callId, node.tagName === "DETAILS" ? node.open : null]));
      const artifactStates = new Map([...entry.querySelectorAll(".artifact-file[data-artifact-card]")]
        .map((node) => {
          const panel = node.querySelector(".artifact-source-panel");
          const code = panel?.querySelector("code");
          return [node.dataset.artifactCard, { expanded: panel ? !panel.hidden : false, source: code?.dataset.loaded ? code.textContent : "" }];
        }));
      const template = document.createElement("template");
      template.innerHTML = renderAssistantFlowHtml(content, parts, runtime.files, stream.messageId);
      const next = template.content.firstElementChild;
      if (!next) return;
      next.querySelectorAll("details.tool-result[data-call-id]").forEach((node) => {
        if (!openStates.has(node.dataset.callId)) return;
        const open = openStates.get(node.dataset.callId);
        if (typeof open === "boolean") node.open = open;
      });
      next.querySelectorAll(".artifact-file[data-artifact-card]").forEach((node) => {
        const remembered = artifactStates.get(node.dataset.artifactCard);
        if (!remembered?.expanded) return;
        const panel = node.querySelector(".artifact-source-panel");
        const code = panel?.querySelector("code");
        const button = node.querySelector("[data-action='artifact-code']");
        if (!panel || !code || !button) return;
        panel.hidden = false;
        code.textContent = remembered.source;
        code.dataset.loaded = "true";
        button.setAttribute("aria-expanded", "true");
        button.title = "收起源码";
        button.setAttribute("aria-label", "收起源码");
      });
      if (flow) flow.replaceWith(next);
      else entry.querySelector(":scope > .message-body")?.prepend(next);
      flow = next;
      stream.paintedToolEvents = events;
      stream.paintedFlowEntry = entry;
      streamMetric("markdownRenders", flow.querySelectorAll(":scope > .assistant-flow-text").length);
      streamMetric("domCommits");
    }
    const tail = flow?.querySelector(":scope > .assistant-flow-text:last-child");
    if (!tail) return;
    const start = Math.max(0, Math.min(content.length, Number(tail.dataset.contentStart) || 0));
    if (structureChanged) {
      stream.paintedMarkdown ||= new WeakMap();
      stream.paintedMarkdown.set(tail, content.slice(start));
      return;
    }
    paintStreamBody(stream, tail, content.slice(start));
  }

  /** 每帧只更新当前助手消息的节点（AGENTS.md 硬约束）；不在视图内时仅同步数据。 */
  function paint(stream) {
    if (!els || !stream || streams.get(stream.conversationId) !== stream) return;
    const { state: acc, messageId, startedAt } = stream;
    const viewing = stream.conversationId === state().activeConversationId && state().route.name === "chat";
    // 滚动手势优先：不做 store 发布、Markdown 解析、DOM 写入或布局读取。
    // idle 回调会 flush 最新快照，因此这里只丢弃中间视觉帧，不丢弃数据。
    if (viewing && userScrollActive) {
      streamMetric("scrollDeferredPaints");
      return;
    }
    store.actions.publishStreamSnapshot(stream.conversationId, stream.messageId, acc);
    const conversation = state().conversations.find((item) => item.id === stream.conversationId);
    const message = conversation && conversation.messages.find((item) => item.id === messageId);
    const answerStarted = Boolean(acc.content) || acc.phase === "answering" || acc.phase === "completed";
    const shouldAutoCollapse = answerStarted && !stream.reasoningAutoCollapsed;
    if (acc.content && !stream.contentStartedAt) stream.contentStartedAt = acc.contentStartedAt || Date.now();
    if (shouldAutoCollapse) {
      // 这是一次性的阶段边界，不依赖面板当前是否展开；否则用户在正文前手动
      // 收起面板后，正文首帧会把“尚未自动收起”误判为下一次自动收起。
      stream.reasoningAutoCollapsed = true;
      if (message) message.reasoningOpen = false;
    }
    const entry = viewing ? findMessageEntry(messageId) : null;
    if (entry) {
      // 消息列表可能因切换会话被重建：重新挂载时补上流式面板或图像等待槽。
      if (!acc.completed) {
        const hadReasoningSheet = Boolean(entry.querySelector(".reasoning-sheet"));
        mountStreamingChrome(entry, stream);
        if (acc.reasoning && !entry.querySelector(".reasoning-sheet")) mountReasoningSheet(entry);
        const sheet = entry.querySelector(".reasoning-sheet");
        // 只在节点重新挂载时恢复一次；持续 paint 不覆盖用户刚刚手动切换的开合状态。
        if (sheet && !hadReasoningSheet) {
          const remembered = message ? message.reasoningOpen : undefined;
          setReasoningSheetOpen(sheet, remembered ?? !answerStarted);
        }
      }
      // 尚无正文时隐藏空正文；等待态只显示转圈，真实 reasoning 到达后才显示思考面板。
      entry.classList.toggle("is-response-pending", !answerStarted && !acc.images.length && !stream.expectsImage);
      const sheet = entry.querySelector(".reasoning-sheet");
      if (sheet) {
        const label = sheet.querySelector(".reasoning-label");
        const body = sheet.querySelector(".reasoning-body");
        const duration = sheet.querySelector(".reasoning-duration");
        const reasoningActive = !answerStarted && !acc.completed;
        if (label) {
          label.textContent = reasoningActive
            ? (acc.format === "responses" ? "正在整理思考…" : "正在思考…")
            : (acc.format === "responses" ? "思考摘要" : "已思考");
        }
        if (acc.reasoning) {
          if (body) paintStreamBody(stream, body, acc.reasoning);
        }
        if (duration) {
          // 思考时间从首个 reasoning 增量起计，不把等待首字节的网络耗时算成思考。
          const reasoningStartedAt = acc.reasoningStartedAt || startedAt;
          const thinkingMs = Math.max(0, (stream.contentStartedAt || Date.now()) - reasoningStartedAt);
          duration.textContent = stream.contentStartedAt
            ? `（用时 ${formatDuration(thinkingMs)}）`
            : `（${formatDuration(thinkingMs)}）`;
        }
        // 正文阶段只自动收起一次；之后的开合完全由用户控制。
        if (shouldAutoCollapse && sheet.dataset.open === "true") {
          setReasoningSheetOpen(sheet, false);
        }
      }
      paintStreamFlow(stream, entry, acc.content, acc.toolEvents);
      const streamImages = normalizeOutputImages(acc.images);
      if (stream.expectsImage || streamImages.length) {
        if (stream.expectsImage && !streamImages.length) mountImageGenerationSlot(entry, messageId);
        stream.imagePaintPromise = paintStreamImages({
          entry,
          messageId,
          images: streamImages,
          onCommit: () => streamMetric("domCommits")
        });
      }
      const meta = entry.querySelector(".message-meta");
      if (meta && !answerStarted && !acc.completed) {
        const status = stream.expectsImage ? "正在生成图片" : acc.reasoning ? "正在思考" : "等待响应";
        paintPendingMeta(meta, status, Date.now() - startedAt);
      } else if (meta && answerStarted && !acc.completed) {
        meta.textContent = formatDuration(Date.now() - startedAt);
      }
    }

    if (viewing) {
      // 流式期间助手正文增长会实时抬高估算占用：圆弧与 tooltip 原位跟进
      refreshContextRing();
      if (followStream) {
        scheduleFollowToBottom();
      } else {
        els.newRepliesBtn.hidden = false;
      }
    }
  }

  function finishStream(conversation) {
    const stream = streams.get(conversation.id);
    if (!stream) return;
    // 最终消息会由下面唯一一次 React 提交完成；取消尚未执行的增量帧，
    // 避免先 innerHTML、再 React 重复解析和挂载整段 Markdown。
    streams.finish(conversation.id, { flush: false });
    const { state: acc, messageId, startedAt, contentStartedAt, timer } = stream;
    if (timer) clearInterval(timer);
    const message = conversation.messages.find((item) => item.id === messageId);
    if (message) {
      message.content = acc.content;
      message.reasoning = acc.reasoning;
      message.reasoningKind = acc.reasoningKind;
      message.durationMs = Date.now() - startedAt;
      const finalContentStartedAt = acc.contentStartedAt || contentStartedAt;
      message.reasoningMs = acc.reasoning
        ? Math.max(0, (finalContentStartedAt || Date.now()) - (acc.reasoningStartedAt || startedAt))
        : 0;
      message.usage = acc.usage || null;
      if (acc.stopped) message.stopped = true;
      if (acc.error) message.error = acc.error;
      const runtimeEvents = normalizeToolEvents(acc.toolEvents);
      const images = normalizeOutputImages([...acc.images, ...runtimeEvents.images]);
      if (images.length) {
        message.parts = [...(message.parts || []), ...images];
      }
      // 运行时版本携带正文锚点，排在 Provider 顶层副本之前并由归一化层去重。
      const files = normalizeOutputFiles([...runtimeEvents.files, ...acc.files]);
      if (files.length) {
        message.parts = [...(message.parts || []), ...files];
      }
      if (acc.skippedAttachments && acc.skippedAttachments.length) {
        const finalUserMessage = [...getActivePath(conversation)].reverse().find((item) => item.id !== messageId && item.role === "user");
        if (finalUserMessage) finalUserMessage.skippedAttachments = acc.skippedAttachments;
        toast(`部分附件未随消息发送：${acc.skippedAttachments.map((item) => String(item.name || "文件")).join("、")}（当前模型不支持该格式）`, { tone: "danger" });
      }
      if (runtimeEvents.parts.length) {
        message.parts = [...(message.parts || []), ...runtimeEvents.parts];
      }
    }
    if (!streams.size) document.body.classList.remove("is-streaming");
    // 流状态清理、最终消息通知、侧栏排序和持久化合成一次同步提交。
    // message 已在上方填入最终值，React 不会先渲染旧快照再渲染终态。
    endFirstResponse(conversation);
    flushSync(() => store.actions.finishStream(conversation.id, messageId, {}));
    renderComposerControls();
    // Business completion is independent of scroll-driven rendering delays.
    if (!scope.disposed && !acc.error && !acc.stopped && acc.completed && state().conversations.includes(conversation)) {
      const request = stream.request;
      try {
        const budget = resolveInputBudget(resolveEffectiveModelConfig(request.provider, request.model), request.config);
        if (shouldCompressResponse(acc, contextEstimate(conversation, request.config, null, request), budget, request.config.compressionThreshold) && compressionPrefix(getMessagesAfterCompression(conversation)).length) {
          void compressContext(conversation, { request });
        }
      } catch (error) { toast(`自动压缩未执行：${error.message}`, { tone: "danger" }); }
    }
    if (state().activeConversationId === conversation.id && state().route.name === "chat") {
      const entry = findMessageEntry(messageId);
      if (entry) bindMessageEvents(entry);
    }
    // 用户在阅读位停留时，给出“有新回复”回底入口（同样适用于一次性到达的完整回复）。
    if (!followStream && stream.conversationId === state().activeConversationId && els) {
      els.newRepliesBtn.hidden = false;
    }
  }

  function stopStream(stream) {
    if (!stream) return;
    streams.stop(stream.conversationId);
  }

  // ============ 用量估算与压缩 ============

  // 用量估算统一走 services/chat/context-usage.js 的 computeContextUsage：
  // 圆环、tooltip 与展开面板共用同一结果，消息范围与 requestMessages 一致。

  async function compressContext(conversation, options = {}) {
    if (compressingIds.has(conversation.id) || streamOf(conversation.id)) return;
    if (!getActivePath(conversation).length) {
      toast("没有可压缩的上下文", { tone: "danger" });
      return;
    }

    const prefix = options.prefix || compressionPrefix(getMessagesAfterCompression(conversation));
    if (!prefix.length) {
      toast("没有可压缩的已完成历史；当前待回答的消息会保留原文。", { tone: "danger" });
      return false;
    }
    compressingIds.add(conversation.id);
    store.actions.setCompression(conversation.id, true);
    renderComposerControls();
    const activePath = getActivePath(conversation);
    const throughMessage = prefix[prefix.length - 1];
    if (!throughMessage) {
      compressingIds.delete(conversation.id);
      store.actions.setCompression(conversation.id, false);
      return;
    }
    const sourceMessages = activePath.slice(0, activePath.findIndex((m) => m.id === throughMessage.id) + 1).filter((m) => !m.noticeKind);
    const sourceSignature = JSON.stringify(sourceMessages);
    const request = options.request || captureRequest(conversation);
    const target = request.compressionTarget;
    const compressionModel = target.model;
    const abort = new AbortController();
    compressionRequests.set(conversation.id, abort);
    // 压缩提示 = 假的模型响应：占位展示进度，结束后保留在对话中可点击回看
    const notice = {
      id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      role: "assistant",
      content: "",
      reasoning: "",
      noticeKind: "context-compress",
      noticeState: "running",
      parts: [],
      files: [],
      createdAt: Date.now(),
      durationMs: 0,
      reasoningMs: 0
    };
    store.actions.appendMessage(conversation.id, notice);
    const isActive = () => {
      const current = activeConversation();
      return Boolean(current && current.id === conversation.id);
    };
    if (isActive()) {
      renderMessages();
      if (followStream) scrollToBottom();
    }
    try {
      const contextSummary = (getValidContextCompression(conversation) || {}).compression?.summary || "";
      const messages = prefix.filter(m => !m.noticeKind).map(m => ({ role: m.role, content: m.content, files: m.files || [], parts: (m.parts || []).filter(p => ["image", "text", "file"].includes(p.type)) }));
      validateAuxiliaryInput(target, { contextSummary, messages });
      const response = await apiFetch(AUXILIARY_CHAT_ROUTES.compress, {
        method: "POST",
        signal: abort.signal,
        body: JSON.stringify({
          provider: target.header,
          model: target.model,
          contextSummary,
          messages
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      if (scope.disposed || !state().conversations.includes(conversation)) return false;
      const currentPath = getActivePath(conversation);
      const currentBoundary = currentPath.findIndex((m) => m.id === throughMessage.id);
      if (currentBoundary < 0 || JSON.stringify(currentPath.slice(0, currentBoundary + 1).filter((m) => !m.noticeKind)) !== sourceSignature) {
        throw new Error("压缩期间历史或分支已变化，请重新压缩");
      }
      if (String(payload.summary || "").length > LIMITS.summaryChars) throw new Error("压缩摘要过长，原历史已保留，请更换压缩模型重试");
      if (!String(payload.summary || "").trim()) throw new Error("压缩结果为空，请重试");
      conversation.contextCompression = {
        summary: String(payload.summary || ""),
        throughMessageId: throughMessage.id,
        sourceMessageCount: activePath.slice(0, activePath.findIndex((m) => m.id === throughMessage.id) + 1).filter((message) => !message.noticeKind).length,
        model: compressionModel,
        createdAt: Date.now()
      };
      store.actions.patchMessage(conversation.id, notice.id, { noticeState: "done" });
      store.touchConversation(conversation);
      store.persistSoon();
      if (isActive()) toast("上下文已压缩", { tone: "ok" });
      return true;
    } catch (error) {
      if (scope.disposed) return false;
      store.actions.patchMessage(conversation.id, notice.id, { noticeState: "error" });
      store.persistSoon();
      if (isActive()) toast(`压缩失败：${error.message}；内容已保留，可重试或调整上下文设置。`, { tone: "danger" });
      return false;
    } finally {
      compressionRequests.delete(conversation.id);
      compressingIds.delete(conversation.id);
      if (!scope.disposed) {
        store.actions.setCompression(conversation.id, false);
        if (isActive()) renderMessages();
        renderComposerControls();
      }
    }
  }

  // ============ 浮层 ============

  function openRuntimePopover(anchor, initialPanel = "root") {
    if (!allowChange(activeConversation())) return null;
    if (popovers.current && popovers.current.kind === "runtime") {
      closeActivePopover();
      return null;
    }
    const conversation = activeConversation();
    if (!conversation) return;
    return openPopover({
      anchor,
      kind: "runtime",
      width: 320,
      cardClass: "runtime-popover",
      align: "right",
      html: "",
      bind() {
        renderRuntimePanel(conversation, initialPanel);
      }
    });
  }

  function renderRuntimePanel(conversation, panel) {
    const popover = popovers.current;
    if (!popover || popover.kind !== "runtime" || popover.closed) return;
    popover.panelCleanup?.();
    popover.panelCleanup = null;
    const card = popover.card;
    // 面板语义类：三个层级共享容器，但各自拥有独立的尺寸与主题样式钩子。
    card.classList.toggle("runtime-root-popover", panel === "root");
    card.classList.toggle("model-popover", panel === "model");
    card.classList.toggle("effort-popover", panel === "effort");
    if (panel === "model") {
      card.style.width = "320px";
      card.innerHTML = modelPanelMarkup(state().providers, conversation);
      card.querySelectorAll("[data-provider-id]").forEach((button) => {
        button.addEventListener("click", () => {
          const providerId = button.dataset.providerId;
          const model = button.dataset.model;
          const provider = state().providers.find((item) => item.id === providerId);
          if (!provider || provider.enabled === false) return;
          selectRuntimeModel(store, conversation, providerId, model);
          popover.close();
          renderComposerControls();
          renderStageActions();
          store.notify("conversation-updated");
        });
      });
      const modelButtons = [...card.querySelectorAll("[data-provider-id]")];
      card.addEventListener("keydown", (event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        if (!modelButtons.length) return;
        event.preventDefault();
        const index = modelButtons.indexOf(document.activeElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? modelButtons.length - 1
          : Math.max(0, Math.min(modelButtons.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
        modelButtons[next].focus({ preventScroll: true });
        modelButtons[next].scrollIntoView({ block: "nearest" });
      }, { once: false, signal: (popover.modelEvents = new AbortController()).signal });
      popover.panelCleanup = () => popover.modelEvents.abort();
      (card.querySelector(".is-selected") || modelButtons[0] || card.querySelector("[data-goto-settings]"))?.focus({ preventScroll: true });
      card.querySelector(".is-selected")?.scrollIntoView({ block: "nearest" });
      const gotoButton = card.querySelector("[data-goto-settings]");
      if (gotoButton) gotoButton.addEventListener("click", () => {
        popover.close();
        location.hash = "#/settings/providers";
      });
    } else if (panel === "effort") {
      card.style.width = "280px";
      const resetLevel = resolveChatConfig(state(), { ...conversation, reasoningEffortOverride: null }).reasoningEffort;
      card.innerHTML = effortPanelMarkup(resolveChatConfig(state(), conversation).reasoningEffort, conversation.model, resetLevel);
      const followButton = card.querySelector("[data-effort-reset]");
      if (followButton) { followButton.setAttribute("aria-label", "恢复跟随配置"); followButton.title = "恢复跟随配置"; }
      card.insertAdjacentHTML("beforeend", `<div class="effort-source" data-effort-source>${conversation.reasoningEffortOverride ? "当前会话自定义" : "正在跟随配置"}</div>`);
      popover.panelCleanup = bindEffortPanel(card, conversation, resetLevel);
      card.querySelector(".effort-rail")?.focus({ preventScroll: true });
    } else {
      card.style.width = "320px";
      const level = effortLevelOf(resolveChatConfig(state(), conversation).reasoningEffort);
      card.innerHTML = runtimeRootPanelMarkup(conversation.model, level.label);
      card.querySelectorAll("[data-runtime-open]").forEach((button) => {
        button.addEventListener("click", () => renderRuntimePanel(conversation, button.dataset.runtimeOpen));
      });
    }
    popover.position();
  }

  function bindEffortPanel(card, conversation, resetLevel) {
    const rail = card.querySelector(".effort-rail");
    if (!rail) return;
    let pointerId = null;
    let pointerOffset = 0;
    const commit = (nextLevel) => {
      if (conversation.reasoningEffortOverride !== nextLevel) {
        selectRuntimeEffort(store, conversation, nextLevel);
        renderComposerControls();
      }
      refreshEffortDom(card, nextLevel);
      const source = card.querySelector("[data-effort-source]");
      if (source) source.textContent = "当前会话自定义";
    };
    const progressFromEvent = (event) => {
      const rect = rail.getBoundingClientRect();
      // All positions use the thumb's center, including the end stops.
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left - 14 - pointerOffset) / Math.max(1, rect.width - 28)));
      return ratio;
    };
    rail.addEventListener("pointerdown", (event) => {
      if (pointerId !== null || !event.isPrimary || event.button !== 0) return;
      pointerId = event.pointerId;
      const thumb = card.querySelector(".effort-rail-thumb");
      const thumbRect = thumb.getBoundingClientRect();
      pointerOffset = event.target === thumb ? event.clientX - (thumbRect.left + thumbRect.width / 2) : 0;
      rail.focus({ preventScroll: true });
      rail.setPointerCapture(pointerId);
      const dragProgress = progressFromEvent(event);
      commit(EFFORT_LEVELS[Math.round(dragProgress * (EFFORT_LEVELS.length - 1))].key);
    });
    rail.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId) return;
      rail.classList.add("is-dragging");
      const dragProgress = progressFromEvent(event);
      commit(EFFORT_LEVELS[Math.round(dragProgress * (EFFORT_LEVELS.length - 1))].key);
    });
    const release = (event) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      rail.classList.remove("is-dragging");
      refreshEffortDom(card, resolveChatConfig(state(), conversation).reasoningEffort);
      if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => rail.addEventListener(type, release));
    rail.addEventListener("keydown", (event) => {
      const index = EFFORT_LEVELS.findIndex((item) => item.key === effortLevelOf(resolveChatConfig(state(), conversation).reasoningEffort).key);
      const offsets = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
      if (!(event.key in offsets) && !["Home", "End"].includes(event.key)) return;
      event.preventDefault();
      rail.classList.add("is-instant");
      const next = event.key === "Home" ? 0 : event.key === "End" ? EFFORT_LEVELS.length - 1
        : Math.max(0, Math.min(EFFORT_LEVELS.length - 1, index + offsets[event.key]));
      commit(EFFORT_LEVELS[next].key);
      scope.frame(() => rail.classList.remove("is-instant"));
    });
    card.querySelector("[data-effort-reset]").addEventListener("click", () => { selectRuntimeEffort(store, conversation, null); refreshEffortDom(card, resetLevel); renderComposerControls(); card.querySelector("[data-effort-source]").textContent = "正在跟随配置"; });
    const visibility = () => card.classList.toggle("is-page-hidden", document.hidden);
    scope.listen(document, "visibilitychange", visibility);
    visibility();
    const resize = new ResizeObserver(() => refreshEffortDom(card, resolveChatConfig(state(), conversation).reasoningEffort));
    resize.observe(rail);
    // 首次测量会提交默认样式；先禁用过渡，避免从默认位置滑到已保存的档位。
    rail.classList.add("is-instant");
    refreshEffortDom(card, resolveChatConfig(state(), conversation).reasoningEffort);
    // 在恢复交互动画前提交最终位置，也让 max 的填充色直接就位。
    void rail.offsetWidth;
    rail.classList.remove("is-instant");
    return () => {
      resize.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }

  function refreshEffortDom(card, level) {
    const current = effortLevelOf(level);
    const index = EFFORT_LEVELS.findIndex((item) => item.key === current.key);
    card.dataset.effort = current.key;
    card.querySelector("[data-effort-current]").textContent = current.label;
    const rail = card.querySelector(".effort-rail");
    const progress = index / (EFFORT_LEVELS.length - 1);
    const travel = Math.max(0, rail.clientWidth - 28);
    rail.style.setProperty("--particle-travel", `${-rail.clientWidth - 6}px`);
    rail.style.setProperty("--particle-duration", `${(rail.clientWidth + 6) / 120}s`);
    rail.setAttribute("aria-valuenow", String(index));
    rail.setAttribute("aria-valuetext", current.label);
    rail.dataset.effortIndex = String(index);
    card.querySelector(".effort-rail-thumb").style.transform = `translate(${progress * travel}px, -50%)`;
    const fill = card.querySelector(".effort-rail-fill");
    fill.style.clipPath = `inset(0 ${rail.clientWidth - 14 - progress * travel}px 0 0 round 12px 0 0 12px)`;
    fill.style.opacity = progress === 0 ? "0" : "1";
    card.querySelectorAll(".effort-rail-dots i").forEach((dot, dotIndex) => {
      dot.classList.toggle("is-past", dotIndex / (EFFORT_LEVELS.length - 1) <= progress);
    });
  }

  // ---- 上下文 tooltip：挂到全局 popoverHost，不被输入纸卡 overflow 裁切 ----

  function showContextTooltip() {
    if (!els || popovers.current) return; // 任何浮层打开期间不叠加 tooltip
    const conversation = activeConversation();
    if (!conversation || !els.usageBtn || !els.usageBtn.isConnected) return;
    const usage = composerContextUsage(conversation);
    if (!contextTooltipEl || !contextTooltipEl.isConnected) {
      contextTooltipEl = document.createElement("div");
      contextTooltipEl.id = "contextTooltip";
      contextTooltipEl.className = "context-tooltip";
      contextTooltipEl.setAttribute("role", "tooltip");
      shell.popoverHost.appendChild(contextTooltipEl);
    }
    contextTooltipEl.innerHTML = contextTooltipLinesMarkup(usage);
    const btnRect = els.usageBtn.getBoundingClientRect();
    contextTooltipEl.classList.add("is-open");
    contextTooltipEl.style.visibility = "hidden";
    const tipRect = contextTooltipEl.getBoundingClientRect();
    let top = btnRect.top - tipRect.height - 10;
    if (top < 10) top = Math.min(window.innerHeight - tipRect.height - 10, btnRect.bottom + 10);
    let left = btnRect.left + btnRect.width / 2 - tipRect.width / 2;
    left = Math.min(window.innerWidth - tipRect.width - 10, Math.max(10, left));
    contextTooltipEl.style.left = `${left}px`;
    contextTooltipEl.style.top = `${top}px`;
    contextTooltipEl.style.visibility = "";
  }

  function hideContextTooltip() {
    clearTimeout(contextTooltipTimer);
    contextTooltipTimer = 0;
    if (contextTooltipEl) contextTooltipEl.classList.remove("is-open");
  }

  // ============ 灯箱 ============

  function openLightbox(source, caption) {
    const lightbox = shell.lightbox;
    lightbox.querySelector("#lightboxImage").src = source;
    lightbox.querySelector("#lightboxCaption").textContent = caption || "";
    lightbox.classList.add("lightbox-open");
  }

  function closeLightbox() {
    shell.lightbox.classList.remove("lightbox-open");
    shell.lightbox.querySelector("#lightboxImage").src = "";
  }

  // ============ 装配 ============

  // React 已同步创建稳定 ChatSurface；控制器在任何异步存储恢复之前绑定输入事件，
  // 避免慢磁盘/并行测试下用户先看到可输入 textarea、事件监听却尚未就绪的竞态。
  renderChatSkeleton();
  bindSidebarEvents();
  const lightboxClose = document.getElementById("lightboxClose");
  if (lightboxClose) scope.listen(lightboxClose, "click", closeLightbox);
  scope.listen(shell.lightbox, "click", (event) => {
    if (event.target === shell.lightbox) closeLightbox();
  });

  return {
    render,
    focusComposer: () => els && els.composerInput.focus(),
    handleShortcutNewConversation,
    closeActivePopover,
    openLightbox,
    closeLightbox,
    dispose() { commands?.dispose(); scope.dispose(); closeActivePopover(); hideContextTooltip(); streams.stopAll(); },
    stopAllStreams: () => streams.stopAll()
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
