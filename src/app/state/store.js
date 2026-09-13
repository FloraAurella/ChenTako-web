import { isConversationLocked } from '../../modules/chat/public/first-response.js';
import { createChatStateActions } from "../../modules/chat/public/state_actions.js";
import { createProjectState } from "../../modules/projects/public/state_actions.js";
import { sortConversations } from "../../modules/chat/public/domain_queries.js";
export { sortConversations,getValidContextCompression,getMessagesAfterCompression,invalidateCompressionForIndex } from "../../modules/chat/public/domain_queries.js";
import { createObservable } from "../../core/observable.js";
"use strict";

/**
 * 单一可观察 store：全部应用状态 + 订阅者 + 双轨持久化（320ms 防抖）。
 * 控制器直接读写 state 字段（可变状态），变更后调用 notify(reason)。
 */

import { STORAGE_KEYS, LIMITS, DEFAULT_EFFORT } from "../../contracts/constants.js";
import {
  createSafeStorage,
  createStateArchive,
  loadPersistedState,
  buildPersistentPayload,
  buildLightweightPayload,
  safeStringify,
  readAppMode,
  writeAppMode
} from "./persistence.js";
import { normalizeConversation, createId } from "../../contracts/normalize.js";
import { normalizeExtensions } from "../../modules/extensions/public/domain_model.js";
import { CHAT_CONFIG_DEFAULTS, resolveChatConfig, SETTINGS_SCHEMA_VERSION } from "../../modules/context/public/domain_config.js";
import { projectName, normalizeProjectSidebar } from "../../modules/projects/public/domain_model.js";
import { resolveEffectiveModelConfig, snapshotProviderForModel } from "../../modules/connections/public/domain_models.js";
import { appendToActivePath, getActivePath } from "../../modules/chat/public/domain_tree.js";

export function createStore() {
  const safeStorage = createSafeStorage();
  const archive = createStateArchive();
  let persistTimer = 0;
  let draftTimer = 0;
  let archiveFailed = false;

  const state = {
    loaded: false,
    appMode: "chat",
    conversations: [],
    projects: [],
    projectKnowledge: {},
    chatConfig: { ...CHAT_CONFIG_DEFAULTS },
    modelCompatibility: {},
    settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
    legacySettingsBackup: null,
    activeConversationId: "",
    providers: [],
    extensions: normalizeExtensions(),
    activeProviderId: "",
    preferredReasoningEffort: DEFAULT_EFFORT,
    route: { name: "chat", settingsSection: "appearance", settingsDetail: false },
    backend: { status: "checking", message: "", checkedAt: 0 },
    sidebar: { query: "", archivesMode: "full", drawerOpen: false, ...normalizeProjectSidebar() },
    streaming: null,
    streamSnapshots: new Map(),
    activeStreamIds: new Set(),
    compressionConversationIds: new Set(),
    pendingAttachments: [],
    pendingAttachmentsByConversation: new Map(),
    editingMessage: null
  };

  const observable = createObservable(snapshotValue);
  const {subscribe,subscribeKey,getSnapshot,notifyKeys} = observable;

  function snapshotValue(key) {
    if (key === "route") return state.route;
    if (key === "sidebar") return state.sidebar;
    if (key === "conversation-list") return state.conversations;
    if (key === "providers") return state.providers;
    if (key === "chat-config") return { chatConfig: state.chatConfig, modelCompatibility: state.modelCompatibility };
    if (key === "projects") return state.projects;
    if (key === "extensions") return state.extensions;
    if (key === "backend") return state.backend;
    if (key === "composer") return {
      pendingAttachments: state.pendingAttachments,
      editingMessage: state.editingMessage,
      activeConversationId: state.activeConversationId
    };
    if (key.startsWith("conversation:")) {
      const conversationId = key.slice("conversation:".length);
      return state.conversations.find((item) => item.id === conversationId) || null;
    }
    if (key.startsWith("message:")) {
      const [, conversationId, messageId] = key.split(":");
      const conversation = state.conversations.find((item) => item.id === conversationId);
      return conversation?.messages.find((item) => item.id === messageId) || null;
    }
    if (key.startsWith("stream:")) return state.streamSnapshots.get(key.slice("stream:".length)) || null;
    if (key === "stream-list") return state.activeStreamIds;
    if (key === "compression") return state.compressionConversationIds;
    return state;
  }

  function keysForReason(reason) {
    if (reason === "chat-config") return ["chat-config", "projects", "composer", `conversation:${state.activeConversationId}`];
    if (String(reason).startsWith("project")) return ["projects", "sidebar", "conversation-list"];
    if (reason === "route") return ["route"];
    if (reason === "backend") return ["backend"];
    if (reason === "providers") return ["providers"];
    if (reason === "extensions") return ["extensions"];
    if (String(reason).startsWith("conversation")) return ["conversation-list", `conversation:${state.activeConversationId}`];
    if (String(reason).startsWith("stream")) return [`stream:${state.activeConversationId}`, `conversation:${state.activeConversationId}`];
    return ["route", "sidebar", "conversation-list", "projects", "chat-config", "providers", "extensions", "backend", "composer"];
  }

  function notify(reason, keys = keysForReason(reason)) {
    notifyKeys(keys, { includeApp: true });
    observable.publish(reason, state);
  }

  async function persist() {
    if (typeof window !== "undefined" && window.__AI_CHATBOX_STREAM_METRICS__) {
      const metrics = window.__AI_CHATBOX_STREAM_METRICS__;
      metrics.persistenceWrites = Number(metrics.persistenceWrites || 0) + 1;
    }
    let payload;
    try {
      payload = buildPersistentPayload(state);
    } catch (error) {
      // 载荷构建失败（历史数据混入无法序列化的内容）绝不能静默中断整条持久化链路。
      console.error("[ai-chatbox] 构建持久化载荷失败", error);
      archiveFailed = true;
      notify("archive-error");
      return false;
    }
    // 轻量备份不依赖 IndexedDB。先写它，确保 IndexedDB 打开失败或被阻塞时，
    // 设置页的供应商、Tool、Skill 仍能在刷新/重启后恢复。
    // safeStringify 保证循环引用/BigInt 不会让备份通道静默消失。
    let fullBackupSaved = false;
    try {
      safeStorage.setItem(STORAGE_KEYS.state, safeStringify(buildLightweightPayload(payload)));
      fullBackupSaved = !safeStorage.isDegraded();
      if (!fullBackupSaved) throw new Error("轻量备份写入失败");
    } catch {
      // localStorage 写满：降级为空会话骨架，保证基本配置仍可恢复。
      try {
        safeStorage.setItem(STORAGE_KEYS.state, safeStringify({
          ...payload,
          lightweight: true,
          degraded: true,
          projectKnowledge: Object.fromEntries(Object.entries(payload.projectKnowledge || {}).map(([id, files]) => [id, files.map(file => ({ ...file, text: null }))])),
          conversations: []
        }));
      } catch { /* 彻底不可写：IndexedDB 归档仍在下方兜底 */ }
    }
    // 草稿以轻量键为准：全量持久化时同步刷新，避免已清空的草稿在重启后复活。
    flushDrafts();

    try {
      await archive.save(payload);
      if (archiveFailed) {
        archiveFailed = false;
        notify("archive-recovered");
      }
    } catch (error) {
      archiveFailed = true;
      // 持久化层记录诊断；界面层同时把 archive-error 显示为内联错误。
      console.error("[ai-chatbox] 本地归档写入失败（配置依赖轻量备份恢复）", error);
      notify("archive-error");
    }
    return !archiveFailed || fullBackupSaved;
  }

  function persistSoon() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persist();
    }, LIMITS.persistDebounceMs);
  }

  /** 草稿轻量落盘：只写一个小 JSON 记录，击键不再触发全量状态序列化。 */
  function flushDrafts() {
    const drafts = {};
    state.conversations.forEach((conversation) => {
      if (conversation.saveChats !== false && conversation.draft) drafts[conversation.id] = conversation.draft;
    });
    try {
      safeStorage.setItem(STORAGE_KEYS.drafts, JSON.stringify(drafts));
    } catch { /* 写满时放弃草稿备份；主存仍会在下次全量持久化时带上 */ }
  }

  function persistDraftSoon() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(flushDrafts, LIMITS.persistDebounceMs);
  }

  function activeConversation() {
    return state.conversations.find((item) => item.id === state.activeConversationId) || null;
  }

  function activeProvider() {
    return state.providers.find((item) => item.id === state.activeProviderId && item.enabled !== false) || null;
  }

  function createConversation({ silent = false, isTemporary = false, projectId = activeConversation()?.projectId ?? null } = {}) {
    const provider = activeProvider() || state.providers.find((item) => item.enabled !== false) || null;

    const conversation = normalizeConversation({
      id: createId(),
      title: "",
      isTemporary,
      projectId: validProjectId(projectId),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      providerId: provider ? provider.id : "",
      providerSnapshot: provider ? snapshotProviderForModel(provider, provider.defaultModel) : null,
      model: provider ? provider.defaultModel : "",
      reasoningEffort: resolveChatConfig(state, { projectId }).reasoningEffort,
      reasoningEffortOverride: null,
      saveChats: resolveChatConfig(state, { projectId }).saveChats,
      messages: []
    });
    state.conversations = sortConversations([conversation, ...state.conversations]);
    state.activeConversationId = conversation.id;
    if (!silent) {
      persistSoon();
      notify("conversation-created");
    }
    return conversation;
  }

  function validProjectId(id) {
    return state.projects.some((project) => project.id === id) ? id : null;
  }

  function revealConversation(id) {
    const conversation = state.conversations.find((item) => item.id === id);
    if (!conversation || state.sidebar.query) return;
    const section = conversation.projectId ? "projects" : "chats";
    actions.setSidebar({
      collapsedSections: state.sidebar.collapsedSections.filter((key) => key !== section),
      collapsedProjectIds: state.sidebar.collapsedProjectIds.filter((key) => key !== conversation.projectId)
    });
  }

  const {createProject,renameProject,moveConversationToProject,deleteProject} = createProjectState({state,persistSoon,notify,validProjectId,revealConversation,activeConversation,canModifyConversation: conversation => !isConversationLocked(conversation)});

  function touchConversation(conversation, { silent = false } = {}) {
    conversation.updatedAt = Date.now();
    state.conversations = sortConversations(state.conversations);
    if (!silent) persistSoon();
  }

  async function load() {
    const persisted = await loadPersistedState();
    const shouldPersistProviderMigration = persisted?.retiredProviderMigrationApplied === true || persisted?.settingsMigrationApplied === true;
    if (persisted) {
      state.conversations = sortConversations(persisted.conversations);
      state.projects = persisted.projects;
      state.projectKnowledge = persisted.projectKnowledge;
      state.chatConfig = persisted.chatConfig;
      state.modelCompatibility = persisted.modelCompatibility;
      state.legacySettingsBackup = persisted.legacySettingsBackup;
      state.sidebar = { ...state.sidebar, ...persisted.projectSidebar };
      state.providers = persisted.providers;
      state.extensions = normalizeExtensions(persisted.extensions);
      state.activeProviderId = state.providers.some((provider) => (
        provider.id === persisted.activeProviderId && provider.enabled !== false
      ))
        ? persisted.activeProviderId
        : (state.providers.find((provider) => provider.enabled !== false)?.id || "");
      state.preferredReasoningEffort = persisted.preferredReasoningEffort || DEFAULT_EFFORT;
      state.activeConversationId = persisted.activeConversationId;
      // 草稿独立轻量存储：击键期间高频更新，以它为准叠加到会话上
      try {
        const rawDrafts = safeStorage.getItem(STORAGE_KEYS.drafts);
        if (rawDrafts) {
          const drafts = JSON.parse(rawDrafts);
          state.conversations.forEach((conversation) => {
            if (typeof drafts[conversation.id] === "string") conversation.draft = drafts[conversation.id];
          });
        }
      } catch { /* 忽略损坏的草稿记录 */ }
    }
    state.appMode = readAppMode(safeStorage);
    if (!state.conversations.length || !state.conversations.some((item) => item.id === state.activeConversationId)) {
      const existing = state.conversations[0];
      state.activeConversationId = existing ? existing.id : "";
      if (!existing) actions.openTemporaryConversation({ silent: true });
    }
    state.loaded = true;
    if (!persisted || shouldPersistProviderMigration) {
      await persist();
    }
    notify("loaded");
    return state;
  }

  function setRoute(route) {
    state.route = { ...state.route, ...route };
    if (route.name === "chat") {
      state.appMode = "chat";
      writeAppMode("chat", safeStorage);
    }
    notify("route");
  }

  function setBackendStatus(status, message = "") {
    state.backend = { status, message, checkedAt: Date.now() };
    notify("backend");
  }

  function conversationById(conversationId) {
    return state.conversations.find((item) => item.id === conversationId) || null;
  }

  const actions = Object.freeze({
    ...createChatStateActions({state,conversationById,notify,notifyKeys,persistSoon,touchConversation,createConversation}),
    setSidebar(patch) {
      state.sidebar = { ...state.sidebar, ...patch };
      if ("collapsedSections" in patch || "collapsedProjectIds" in patch) persistSoon();
      notifyKeys(["app", "sidebar"]);
    },
    setProviders(providers) {
      state.providers = providers;
      if (!providers.some((provider) => provider.id === state.activeProviderId && provider.enabled !== false)) {
        state.activeProviderId = providers.find((provider) => provider.enabled !== false)?.id || "";
      }
      persistSoon();
      notify("providers", ["providers"]);
    },
    setExtensions(extensions) {
      state.extensions = normalizeExtensions(extensions);
      persistSoon();
      notify("extensions", ["extensions"]);
    }
  });

  return {
    state,
    subscribe,
    subscribeKey,
    getSnapshot,
    notifyKeys,
    notify,
    persist,
    persistSoon,
    persistDraftSoon,
    flushDrafts,
    load,
    createConversation,
    createProject,
    renameProject,
    deleteProject,
    moveConversationToProject,
    revealConversation,
    touchConversation,
    activeConversation,
    activeProvider,
    setRoute,
    setBackendStatus,
    actions,
    sortConversations
  };
}
