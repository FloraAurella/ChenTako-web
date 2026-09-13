import { isConversationLocked, FIRST_RESPONSE_LOCK_REASON } from '../domain/first-response.js';
import { renderMarkdown } from "../../../shared/markdown.js";
import { icon } from "../../../resources/icons/index.js";
import { formatBytes, formatDuration, formatTime, formatTokenCount } from "../../../shared/utils.js";
import { TEXT_FILE_EXTENSIONS } from "../../../contracts/constants.js";
import { imageGenerationSlotHtml } from "./stream-images.ts";
import { getActivePath, getUserVariants } from "../domain/tree.js";

// Stable conversation switches should reuse the expensive Markdown/code HTML.
// Keep this cache bounded by both entries and characters because a single
// assistant reply can contain a large code block or several data URLs.
const MESSAGE_HTML_CACHE_MAX_ENTRIES = 320;
const MESSAGE_HTML_CACHE_MAX_CHARS = 8 * 1024 * 1024;
const messageHtmlCache = new Map();
let messageHtmlCacheChars = 0;

function escapeHtml(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function escapeAttr(value) { return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function reasoningBodyId(messageId) { return `reasoning-body-${String(messageId || "message").replace(/[^a-zA-Z0-9_-]/g, "-")}`; }

function messageCacheKey(message, options) {
  const conversation = options.conversation || {};
  const branch = options.branch;
  return JSON.stringify([
    conversation.id || "",
    message.id || "",
    conversation.model || "",
    options.providerName || "",
    options.index,
    options.pathLength,
    options.suppressEntryAnimation ? 1 : 0,
    branch ? `${branch.current}/${branch.total}/${branch.hasPrevious ? 1 : 0}/${branch.hasNext ? 1 : 0}` : "-",
    options.streamActive ? 1 : 0,
    options.streamMessageId || "",
    options.streamExpectsImage ? 1 : 0,
    options.editingMessageId || "",
    options.compressing ? 1 : 0
  ]);
}

function messageCacheSnapshot(message) {
  return {
    message,
    role: message.role,
    content: message.content || "",
    reasoning: message.reasoning || "",
    reasoningKind: message.reasoningKind || "",
    reasoningOpen: message.reasoningOpen,
    reasoningMs: message.reasoningMs || 0,
    durationMs: message.durationMs || 0,
    usage: message.usage,
    stopped: message.stopped === true,
    error: message.error || "",
    noticeKind: message.noticeKind || "",
    noticeState: message.noticeState || "",
    createdAt: message.createdAt,
    files: message.files,
    parts: message.parts,
    skippedAttachments: message.skippedAttachments
  };
}

function sameMessageCacheSnapshot(snapshot, message) {
  return snapshot && snapshot.message === message &&
    snapshot.role === message.role &&
    snapshot.content === (message.content || "") &&
    snapshot.reasoning === (message.reasoning || "") &&
    snapshot.reasoningKind === (message.reasoningKind || "") &&
    snapshot.reasoningOpen === message.reasoningOpen &&
    snapshot.reasoningMs === (message.reasoningMs || 0) &&
    snapshot.durationMs === (message.durationMs || 0) &&
    snapshot.usage === message.usage &&
    snapshot.stopped === (message.stopped === true) &&
    snapshot.error === (message.error || "") &&
    snapshot.noticeKind === (message.noticeKind || "") &&
    snapshot.noticeState === (message.noticeState || "") &&
    snapshot.createdAt === message.createdAt &&
    snapshot.files === message.files &&
    snapshot.parts === message.parts &&
    snapshot.skippedAttachments === message.skippedAttachments;
}

function rememberMessageHtml(key, message, html) {
  const previous = messageHtmlCache.get(key);
  if (previous) messageHtmlCacheChars -= previous.html.length;
  const entry = { snapshot: messageCacheSnapshot(message), html };
  messageHtmlCache.set(key, entry);
  messageHtmlCacheChars += html.length;

  // Map insertion order is the LRU order. Touching a hit below moves it to
  // the end; eviction therefore stays O(number of evicted entries).
  while (messageHtmlCache.size > MESSAGE_HTML_CACHE_MAX_ENTRIES || messageHtmlCacheChars > MESSAGE_HTML_CACHE_MAX_CHARS) {
    const oldestKey = messageHtmlCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = messageHtmlCache.get(oldestKey);
    messageHtmlCache.delete(oldestKey);
    messageHtmlCacheChars -= oldest?.html.length || 0;
  }
}

function cachedMessageHtml(message, options) {
  const key = messageCacheKey(message, options);
  const cached = messageHtmlCache.get(key);
  if (cached && sameMessageCacheSnapshot(cached.snapshot, message)) {
    messageHtmlCache.delete(key);
    messageHtmlCache.set(key, cached);
    return cached.html;
  }
  const html = renderMessageHtml(message, options);
  rememberMessageHtml(key, message, html);
  return html;
}

function filePart(part, messageId, partsIndex) {
  const mime = String(part.mimeType || "").split(";")[0].trim().toLowerCase();
  const name = escapeHtml(part.name || "文件");
  const nameAttr = escapeAttr(part.name || "文件");
  const size = formatBytes(Number(part.size) || 0);
  if (mime.startsWith("audio/")) return `<div class="message-media"><span class="file-name" title="${nameAttr}">${name}</span><audio controls preload="none" src="${escapeAttr(part.source || "")}"></audio></div>`;
  if (mime.startsWith("video/")) return `<div class="message-media"><span class="file-name" title="${nameAttr}">${name}</span><video controls preload="none" playsinline src="${escapeAttr(part.source || "")}"></video></div>`;
  return `<div class="file-card"><span class="file-icon">${icon("file", 15)}</span><span class="file-name" title="${nameAttr}">${name}</span><span class="file-size">${size}</span><button type="button" class="file-download" data-message-id="${escapeAttr(messageId)}" data-file-parts-index="${partsIndex}" aria-label="下载">${icon("download", 14)}</button></div>`;
}

function artifactPreviewKind(part) {
  if (!String(part?.source || "").startsWith("data:")) return "";
  const mime = String(part?.mimeType || "").split(";")[0].trim().toLowerCase();
  const extension = String(part?.name || "").split(".").pop()?.toLowerCase() || "";
  if (mime === "text/html" || extension === "html" || extension === "htm") return "html";
  if (mime === "image/svg+xml" || extension === "svg") return "svg";
  return "";
}

function artifactHasSource(part) {
  if (!String(part?.source || "").startsWith("data:")) return false;
  const mime = String(part?.mimeType || "").split(";")[0].trim().toLowerCase();
  const extension = String(part?.name || "").split(".").pop()?.toLowerCase() || "";
  return mime.startsWith("text/") || mime === "application/json" || mime === "application/xml" ||
    mime === "application/javascript" || mime === "image/svg+xml" ||
    ["json", "xml", "yaml", "yml", "md", "txt", "css", "js", "ts", "tsx", "jsx", "py", "sh", "html", "htm", "svg"].includes(extension);
}

function artifactFile(part, messageId, partsIndex) {
  const previewKind = artifactPreviewKind(part);
  const hasSource = artifactHasSource(part);
  const artifactId = escapeAttr(part.artifactId || "");
  const partIndex = Number.isInteger(partsIndex) ? ` data-file-parts-index="${partsIndex}"` : "";
  const locator = ` data-message-id="${escapeAttr(messageId)}" data-artifact-id="${artifactId}"${partIndex}`;
  const name = escapeHtml(part.name || "文件");
  const nameAttr = escapeAttr(part.name || "文件");
  const actions = [
    hasSource ? `<button type="button" class="artifact-action artifact-code" data-action="artifact-code"${locator} title="查看源码" aria-label="查看源码" aria-expanded="false">${icon("code", 15)}</button>` : "",
    previewKind ? `<button type="button" class="artifact-action artifact-run" data-action="artifact-run" data-preview-kind="${previewKind}"${locator} title="运行${previewKind === "svg" ? " SVG" : " HTML"}" aria-label="运行${previewKind === "svg" ? " SVG" : " HTML"}">${icon("play", 15)}</button>` : "",
    hasSource ? `<button type="button" class="artifact-action artifact-copy" data-action="artifact-copy"${locator} title="复制源码" aria-label="复制源码">${icon("copy", 15)}</button>` : "",
    `<button type="button" class="artifact-action file-download"${locator} title="下载文件" aria-label="下载文件">${icon("download", 15)}</button>`
  ].join("");
  return `<div class="artifact-file" data-artifact-card="${artifactId}"><div class="artifact-file-head"><span class="file-icon">${icon("file", 15)}</span><span class="file-name" title="${nameAttr}">${name}</span><span class="file-size">${formatBytes(Number(part.size) || 0)}</span><span class="artifact-actions">${actions}</span></div><div class="artifact-source-panel" hidden><pre><code></code></pre></div></div>`;
}

function reasoning(message, defaultOpen = false) {
  const label = message.reasoningKind === "summary" ? "思考摘要" : "已思考";
  const duration = message.reasoningMs ? `（用时 ${formatDuration(message.reasoningMs)}）` : "";
  const open = message.reasoningOpen === true || (message.reasoningOpen === undefined && defaultOpen);
  const bodyId = reasoningBodyId(message.id);
  return `<div class="reasoning-sheet" data-open="${open ? "true" : "false"}"><button type="button" class="reasoning-toggle" data-action="toggle-reasoning" aria-expanded="${open ? "true" : "false"}" aria-controls="${escapeAttr(bodyId)}"><span class="reasoning-mark">${icon("leaf", 16, "reasoning-icon")}</span><span class="reasoning-label">${label}</span><span class="reasoning-duration">${duration}</span><span class="chevron">${icon("chevronRight", 13)}</span></button><div class="reasoning-content"><div class="reasoning-clip"><div id="${escapeAttr(bodyId)}" class="reasoning-body markdown-body">${renderMarkdown(message.reasoning)}</div></div></div></div>`;
}

function toolPart(part) {
  const successful = part.status === "succeeded" || part.status === "applied" || part.type === "skill_applied";
  const running = part.status === "running" || part.status === "requested";
  const label = part.type === "skill_applied" || part.status === "applied" ? "已应用" : successful ? "已完成" : part.status === "running" ? "执行中" : part.status === "requested" ? "等待执行" : part.status === "cancelled" ? "已取消" : "失败";
  const source = part.name === "clawbox_code_interpreter" ? "代码解释器" : part.source === "sandbox" ? "沙箱" : part.source === "skill" || part.type === "skill_applied" ? "Skill" : "Tool";
  const output = String(part.output || "").trim();
  const input = String(part.input || "").trim();
  const blocks = Array.isArray(part.content) ? part.content : [];
  const results = blocks.length ? blocks.map((block) => `<div class="tool-result-block"><span>${block.type === "json" ? "JSON" : "结果"}</span><pre>${escapeHtml(block.text || "")}</pre></div>`).join("") : output ? `<div class="tool-result-block"><span>结果</span><pre>${escapeHtml(output)}</pre></div>` : "";
  const inputDetails = part.type === "skill_applied" || !input ? "" : `<details class="tool-result-input"><summary>查看调用参数</summary><pre>${escapeHtml(input)}</pre></details>`;
  const details = `${results}${inputDetails}`;
  const frame = successful ? "is-success" : running ? "is-running" : "is-error";
  const iconName = part.type === "skill_applied" ? "spark" : running ? "clock" : successful ? "check" : "alert";
  const action = part.type === "skill_applied" ? "应用了" : running ? "正在调用" : successful ? "调用了" : part.status === "cancelled" ? "已取消" : "调用失败";
  const chevron = details ? `<span class="tool-result-chevron">${icon("chevronRight", 12)}</span>` : "";
  const head = `<span class="tool-result-icon">${icon(iconName, 14)}</span><span class="tool-result-title"><span class="tool-result-action">${action} ${source}</span><span class="tool-result-name">${escapeHtml(part.name || (part.type === "skill_applied" ? "未命名 Skill" : "未命名工具"))}</span></span><span class="tool-result-status">${label}${part.durationMs ? ` · ${formatDuration(part.durationMs)}` : ""}</span>${chevron}`;
  const callId = escapeAttr(part.callId || "");
  return details ? `<details class="tool-result tool-activity ${frame}" data-call-id="${callId}"><summary>${head}</summary><div class="tool-result-content">${details}</div></details>` : `<div class="tool-result tool-activity ${frame}" data-call-id="${callId}"><div class="tool-result-summary">${head}</div></div>`;
}

export function renderToolActivitiesHtml(parts) {
  const toolParts = (Array.isArray(parts) ? parts : []).filter((part) => ["tool_call", "tool_result", "skill_applied"].includes(part.type));
  return toolParts.length ? `<div class="tool-results" aria-label="工具运行记录">${toolParts.map(toolPart).join("")}</div>` : "";
}

function anchoredFlowGroups(content, parts, files) {
  const length = content.length;
  const tools = (Array.isArray(parts) ? parts : [])
    .filter((part) => ["tool_call", "tool_result", "skill_applied"].includes(part.type))
    .map((part, index) => ({
      kind: "tool",
      part,
      index,
      offset: Math.max(0, Math.min(length, Math.floor(Number(part.contentOffset) || 0)))
    }));
  const artifacts = (Array.isArray(files) ? files : []).map((entry, index) => {
    const part = entry?.part || entry;
    return {
      kind: "file",
      part,
      partsIndex: Number.isInteger(entry?.partIndex) ? entry.partIndex : undefined,
      index: tools.length + index,
      offset: Math.max(0, Math.min(length, Math.floor(Number(part?.contentOffset) || 0)))
    };
  });
  const ordered = [...tools, ...artifacts]
    .sort((a, b) => a.offset - b.offset || a.index - b.index);
  const groups = [];
  for (const item of ordered) {
    const current = groups[groups.length - 1];
    if (current && current.offset === item.offset) current.items.push(item);
    else groups.push({ offset: item.offset, items: [item] });
  }
  return groups;
}

/** 将正文和工具按首次事件锚点渲染为一个连续阅读流；无锚点旧数据保持正文前展示。 */
export function renderAssistantFlowHtml(content, toolParts, artifactFiles = [], messageId = "") {
  const text = String(content || "");
  const groups = anchoredFlowGroups(text, toolParts, artifactFiles);
  if (!groups.length) {
    return `<div class="assistant-flow"><div class="assistant-flow-text markdown-body" data-content-start="0">${renderMarkdown(text)}</div></div>`;
  }
  const items = [];
  let cursor = 0;
  for (const group of groups) {
    if (group.offset > cursor) {
      items.push(`<div class="assistant-flow-text markdown-body" data-content-start="${cursor}">${renderMarkdown(text.slice(cursor, group.offset))}</div>`);
    }
    const tools = group.items.filter((item) => item.kind === "tool").map((item) => item.part);
    const files = group.items.filter((item) => item.kind === "file");
    items.push(`<div class="assistant-flow-tools" data-content-offset="${group.offset}">${renderToolActivitiesHtml(tools)}${files.length ? `<div class="artifact-files">${files.map((item) => artifactFile(item.part, messageId, item.partsIndex)).join("")}</div>` : ""}</div>`);
    cursor = group.offset;
  }
  // 始终保留尾段，供流式后续正文原位追加；空段不占据视觉空间。
  items.push(`<div class="assistant-flow-text markdown-body" data-content-start="${cursor}">${renderMarkdown(text.slice(cursor))}</div>`);
  return `<div class="assistant-flow">${items.join("")}</div>`;
}

function actions(message, index, conversation, busy, pathLength) {
  const lastAssistant = message.role === "assistant" && index === pathLength - 1;
  const locked = isConversationLocked(conversation);
  const disabled = busy || locked ? " disabled" : "";
  const buttons = [
    `<button type="button" class="icon-btn small" data-message-action="copy" title="复制${message.role === "assistant" ? "（含思考）" : ""}" aria-label="复制">${icon("copy", 14)}</button>`,
    `<button type="button" class="icon-btn small" data-message-action="edit" title="编辑" aria-label="编辑"${disabled}>${icon("edit", 14)}</button>`,
    `<button type="button" class="icon-btn small" data-message-action="branch" title="复制到新对话" aria-label="复制到新对话"${disabled}>${icon("branch", 14)}</button>`,
    ...(message.role === "assistant" && (lastAssistant || message.error) ? [`<button type="button" class="icon-btn small" data-message-action="regenerate" title="重新生成" aria-label="重新生成"${disabled}>${icon("refresh", 14)}</button>`] : []),
    `<button type="button" class="icon-btn small danger" data-message-action="delete" title="删除消息" aria-label="删除消息"${disabled}>${icon("trash", 14)}</button>`
  ];
  const stopped = message.stopped && !message.error ? `<span class="stopped-note">${icon("stop", 12)} 已停止生成</span>` : "";
  return `<div class="message-actions${message.error || stopped ? " always-visible" : ""}">${stopped}${buttons.map(button => locked && !button.includes('data-message-action="copy"') ? button.replace(/title="[^"]*"/, `title="${FIRST_RESPONSE_LOCK_REASON}"`) : button).join("")}</div>`;
}

function branchSwitcher(branch) {
  if (!branch || branch.total < 2) return "";
  const previousDisabled = !branch.hasPrevious ? " disabled" : "";
  const nextDisabled = !branch.hasNext ? " disabled" : "";
  return `<nav class="message-branch-switcher" aria-label="消息分支">
    <button type="button" class="branch-nav-btn" data-message-branch="previous" title="上一个消息分支" aria-label="上一个消息分支"${previousDisabled}>${icon("chevronLeft", 15)}</button>
    <span class="branch-count" aria-live="polite">${branch.current} / ${branch.total}</span>
    <button type="button" class="branch-nav-btn" data-message-branch="next" title="下一个消息分支" aria-label="下一个消息分支"${nextDisabled}>${icon("chevronRight", 15)}</button>
  </nav>`;
}

function editor(message) {
  const user = message.role === "user";
  const messageId = escapeAttr(message.id);
  const accept = `.${TEXT_FILE_EXTENSIONS.join(",.")},.png,.jpg,.jpeg,.webp,.gif,image/*`;
  const save = user ? "" : `<button type="button" class="editor-action-btn save" data-editor="save" title="保存" aria-label="保存">${icon("check", 16)}</button>`;
  const hasAttachment = Boolean(
    (message.files && message.files.length) ||
    (message.parts && message.parts.some((part) => part && ["image", "file"].includes(part.type)))
  );
  const resendDisabled = user && !String(message.content || "").trim() && !hasAttachment ? " disabled" : "";
  const resend = user ? `<button type="button" class="editor-action-btn primary" data-editor="resend" title="保存并重新发送（⌘↵）" aria-label="保存并重新发送"${resendDisabled}>${icon("send", 16)}</button>` : "";
  return `<div class="message-entry ${user ? "user" : "assistant"} editing" data-message-id="${messageId}"><div class="message-editor"><textarea class="editor-textarea" rows="6" aria-label="编辑消息内容">${escapeHtml(message.content)}</textarea>${user ? `<div class="composer-chips editor-chips" hidden></div>` : ""}<div class="editor-actions">${user ? `<button type="button" class="editor-action-btn" data-editor="attach" title="添加附件" aria-label="添加附件">${icon("paperclip", 16)}</button>` : ""}<span class="editor-spacer"></span><button type="button" class="editor-action-btn cancel" data-editor="cancel" title="取消编辑（Esc）" aria-label="取消编辑">${icon("close", 16)}</button>${save}${resend}</div></div>${user ? `<input type="file" class="editor-file-input" multiple hidden accept="${accept}" />` : ""}</div>`;
}

function notice(message, running) {
  const interrupted = !running && message.noticeState === "running";
  const isError = message.noticeState === "error" || interrupted;
  const isDone = !running && !isError;
  const frame = isError ? "is-error" : running ? "is-running" : "is-success";
  const iconName = isError ? "alert" : running ? "clock" : "check";
  const text = running ? "正在压缩上下文" : interrupted ? "上下文压缩已中断" : isError ? "上下文压缩失败" : "上下文已压缩";
  const hint = running ? "压缩中" : interrupted ? "未完成" : isError ? "失败" : "已完成";
  return `<div class="message-entry assistant" data-message-id="${escapeAttr(message.id)}"><div class="compress-notice ${frame}" role="button" tabindex="0" data-notice="context-compress" title="点击查看压缩状态"><span class="compress-notice-icon">${icon(iconName, 14)}</span><span class="compress-notice-title"><span class="compress-notice-action">${text}</span></span><span class="compress-notice-status">${hint}</span><span class="compress-notice-chevron">${icon("chevronRight", 12)}</span></div></div>`;
}

/** Pure, bounded message-card serialization. The controller supplies only dynamic session state. */
export function renderMessageHtml(message, { conversation, index, pathLength, branch, suppressEntryAnimation = false, providerName, streamActive, streamMessageId, streamExpectsImage = false, editingMessageId, compressing }) {
  if (message.id === editingMessageId) return editor(message);
  if (message.noticeKind === "context-compress") return notice(message, message.noticeState === "running" && compressing);
  const user = message.role === "user";
  const files = message.files?.length ? `<div class="message-files">${message.files.map((file) => `<div class="file-card"><span class="file-icon">${icon("file", 15)}</span><span class="file-name" title="${escapeAttr(file.name)}">${escapeHtml(file.name)}</span><span class="file-size">${formatBytes(file.text.length)}</span></div>`).join("")}</div>` : "";
  const parts = message.parts || [];
  const imageParts = parts.filter((part) => part.type === "image" && part.source);
  const fileParts = parts.map((part, partIndex) => ({ part, partIndex })).filter(({ part }) => part.type === "file" && part.source);
  const anchoredFiles = fileParts.filter(({ part }) => Number.isFinite(Number(part.contentOffset)));
  const unanchoredFiles = fileParts.filter(({ part }) => !Number.isFinite(Number(part.contentOffset)));
  const toolParts = parts.filter((part) => ["tool_call", "tool_result", "skill_applied"].includes(part.type));
  const unknown = parts.filter((part) => !["text", "image", "file", "tool_call", "tool_result", "skill_applied"].includes(part.type));
  const messageId = escapeAttr(message.id);
  const images = imageParts.length ? `<div class="message-images">${imageParts.map((part, imageIndex) => `<button type="button" class="message-image" data-image-index="${imageIndex}" data-message-id="${messageId}" aria-label="放大图片"><img src="${escapeAttr(part.source)}" alt="${escapeAttr(part.alt || "图片")}" loading="lazy" /></button>`).join("")}</div>` : "";
  const media = unanchoredFiles.length ? `<div class="message-files">${unanchoredFiles.map(({ part, partIndex }) => filePart(part, message.id, partIndex)).join("")}</div>` : "";
  const unsupported = unknown.length ? `<div class="unsupported-part">${icon("info", 13)} 该消息包含暂不支持的内容类型（${escapeHtml(unknown.map((part) => part.type).join("、"))}），已原样保留。</div>` : "";
  const skipped = message.skippedAttachments?.length ? `<div class="unsupported-part">${icon("info", 13)} 因当前模型不支持，部分附件未随消息发送：${escapeHtml(message.skippedAttachments.map((item) => `${item.name}（${item.reason}）`).join("、"))}</div>` : "";
  const meta = [formatTime(message.createdAt), ...(!user ? [message.durationMs ? formatDuration(message.durationMs) : "", message.usage ? `${formatTokenCount(message.usage.totalTokens)} tokens` : ""].filter(Boolean) : [])];
  const error = message.error ? `<div class="message-error">${icon("alert", 15)}<span>${escapeHtml(message.error)}</span><button type="button" class="retry-link" data-message-action="regenerate">重试</button></div>` : "";
  const pendingImage = !user && streamActive && streamMessageId === message.id && streamExpectsImage && !imageParts.length
    ? imageGenerationSlotHtml(message.id)
    : "";
  const messageText = user
    ? `<div class="markdown-body">${renderMarkdown(message.content)}</div>`
    : renderAssistantFlowHtml(message.content, toolParts, anchoredFiles, message.id);
  const body = `${messageText}${files}${media}${images}${pendingImage}${unsupported}${skipped}${error}`;
  const actionHtml = actions(message, index, conversation, streamActive, Number.isFinite(pathLength) ? pathLength : conversation.messages.length);
  const branchHtml = user ? branchSwitcher(isConversationLocked(conversation) && branch ? { ...branch, hasPrevious: false, hasNext: false } : branch) : "";
  const instantClass = suppressEntryAnimation ? " branch-switch-instant" : "";
  if (user) return `<div class="message-entry user${instantClass}" data-message-id="${messageId}"><div class="message-paper">${body}</div>${branchHtml}<div class="message-meta">${meta.join(" · ")}</div>${actionHtml}</div>`;
  const responsePending = streamActive && streamMessageId === message.id && !message.content && !streamExpectsImage;
  return `<div class="message-entry assistant${responsePending ? " is-response-pending" : ""}${instantClass}" data-message-id="${messageId}"><div class="assistant-head"><span class="assistant-glyph">${icon("leaf", 13)}</span><span class="assistant-name">${escapeHtml(providerName)}</span><span class="assistant-model">${escapeHtml(conversation.model || "model")}</span></div>${message.reasoning ? reasoning(message, streamActive && streamMessageId === message.id) : ""}<div class="message-body">${body}</div><div class="message-meta">${meta.join(" · ")}</div>${actionHtml}</div>`;
}

/** Render stable message cards once so selecting a warm conversation is mostly a DOM swap. */
export function renderMessageHtmlCached(message, options) {
  // Only the currently streaming assistant has dynamic chrome. Other cards in
  // the same conversation can still reuse their stream-aware stable HTML,
  // which matters when the user views an older branch during generation.
  const isStreamingMessage = options.streamActive && options.streamMessageId === message.id;
  if (isStreamingMessage || options.editingMessageId || options.compressing) {
    return renderMessageHtml(message, options);
  }
  return cachedMessageHtml(message, options);
}

/** Pre-render the currently selected path for a sidebar intent (hover/focus/click). */
export function preloadConversationMessageHtml(conversation, { providerName = "" } = {}) {
  if (!conversation) return 0;
  const path = getActivePath(conversation);
  const pathLength = path.length;
  path.forEach((message, index) => {
    const variants = message.role === "user" ? getUserVariants(conversation, message.id, path) : null;
    renderMessageHtmlCached(message, {
      conversation,
      index,
      pathLength,
      branch: variants && variants.total > 1 && variants.activeIndex >= 0 ? {
        current: variants.activeIndex + 1,
        total: variants.total,
        hasPrevious: variants.activeIndex > 0,
        hasNext: variants.activeIndex < variants.total - 1
      } : null,
      providerName,
      streamActive: false,
      streamMessageId: "",
      streamExpectsImage: false,
      editingMessageId: "",
      compressing: false
    });
  });
  return pathLength;
}

export function renderEmptyStageHtml(providerName, backendStatus = "ok") {
  const suggestions = [
    "帮我给一份周报拟三个清晰的小标题",
    "把这段思路整理成一份可执行的清单",
    "用一段话解释这个概念，像写给同事的信"
  ];
  const configured = Boolean(providerName);
  const ready = configured && backendStatus === "ok";
  const title = backendStatus === "down" ? "本地服务未连接" : backendStatus === "checking" ? "正在检查连接" : configured ? "今天想聊点什么？" : "先连接一个模型";
  const description = backendStatus === "down" ? "请启动本地服务，或检查连接设置。"
    : backendStatus === "checking" ? "请稍候…"
    : configured ? "输入问题，开始对话。" : "添加供应商并选择模型后即可聊天。";
  const link = backendStatus === "down" ? '<a class="empty-setup-link" href="#/settings/providers">查看连接设置</a>'
    : backendStatus === "ok" && !configured ? '<a class="empty-setup-link" href="#/settings/providers">配置模型</a>' : '';
  return `<div class="empty-stage"><div class="paper-panel empty-card"><div class="empty-eyebrow">${escapeHtml(providerName || "ai-chatbox")}</div><h2 class="empty-title">${title}</h2><p class="empty-lede">${description}</p>${link}${ready ? '<div class="empty-divider"></div>' : ""}<div class="suggestion-list">${(ready ? suggestions : []).map((text, index) => `<button type="button" class="suggestion-card" data-suggestion="${index}"><span class="suggestion-index">0${index + 1}</span><span class="suggestion-text">${escapeHtml(text)}</span></button>`).join("")}</div></div></div>`;
}
