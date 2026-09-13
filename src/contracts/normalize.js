import { normalizeWork, migrateWritingMessages } from '../modules/writing/public/work';
"use strict";

/** 数据模型校验与归一化：所有持久化数据加载/导入都必须经过这里。 */

import { LIMITS, EFFORT_LEVELS, IMAGE_MIME_TYPES } from "./constants.js";
import { normalizeExtensionSelection } from "../modules/extensions/public/domain_model.js";
import { normalizeModelOverrides } from "../modules/connections/public/domain_models.js";

export function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(num)));
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function cleanString(value, max = LIMITS.messageChars) {
  return String(value ?? "").slice(0, max);
}

// ---- 图片源白名单：data:image(png/jpeg/webp/gif)、https、回环 http ----

const DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;
const HTTPS_PATTERN = /^https:\/\/\S{1,4096}$/i;
const LOOPBACK_HTTP_PATTERN = /^http:\/\/(?:127(?:\.\d{1,3}){3}|localhost|\[::1\])(?::\d+)?\/?\S{0,4096}$/i;
const DATA_FILE_PATTERN = /^data:([a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*);base64,[A-Za-z0-9+/=\s]+$/i;

export function isSafeImageSource(source) {
  const value = String(source || "");
  if (!value) return false;
  return DATA_IMAGE_PATTERN.test(value) || HTTPS_PATTERN.test(value) || LOOPBACK_HTTP_PATTERN.test(value);
}

/** 非图片文件源白名单：任意 mime 的 data URL、https、回环 http（与 isSafeImageSource 同构）。 */
export function isSafeFileSource(source) {
  const value = String(source || "");
  if (!value) return false;
  return DATA_FILE_PATTERN.test(value) || HTTPS_PATTERN.test(value) || LOOPBACK_HTTP_PATTERN.test(value);
}

export function imageByteSize(source) {
  const value = String(source || "");
  const match = value.match(/^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return value.length;
  const encoded = match[1].replace(/\s/g, "");
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(encoded.length * 0.75) - padding);
}

/** 任意 mime data URL 的近似字节数（与 imageByteSize 同公式）。 */
export function fileByteSize(source) {
  const value = String(source || "");
  const match = value.match(/^data:[a-z0-9!#$&^_.+/-]+;base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return value.length;
  const encoded = match[1].replace(/\s/g, "");
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(encoded.length * 0.75) - padding);
}

// ---- 模型能力三态（true / false / "auto"） ----

export function normalizeModelCapabilities(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  const flag = (value) => (value === true ? true : value === false ? false : "auto");
  return {
    visionInput: flag(source.visionInput),
    imageOutput: flag(source.imageOutput)
  };
}

function capabilitiesForModel(map, model) {
  const entry = map && typeof map === "object" ? map[model] : null;
  return normalizeModelCapabilities(entry);
}

// ---- 供应商 ----

const KNOWN_FORMATS = ["responses", "anthropic", "openai-compatible", "google"];

export function normalizeProvider(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const models = [...new Set(
    (Array.isArray(source.models) ? source.models : [])
      .map((model) => String(model || "").trim())
      .filter(Boolean)
  )];
  const format = KNOWN_FORMATS.includes(source.responseFormat) ? source.responseFormat : "openai-compatible";
  const capsMap = source.modelCapabilities && typeof source.modelCapabilities === "object"
    ? source.modelCapabilities
    : {};
  const modelCapabilities = {};
  models.forEach((model) => {
    modelCapabilities[model] = capabilitiesForModel(capsMap, model);
  });
  const defaultModel = models.includes(source.defaultModel) ? source.defaultModel : (models[0] || "");
  return {
    id: String(source.id || createId()),
    displayName: cleanString(source.displayName, 80).trim() || "未命名供应商",
    baseUrl: String(source.baseUrl || "").trim().replace(/\/+$/, ""),
    responseFormat: format,
    defaultReasoningEffort: ["low", "medium", "high", "xhigh", "max"].includes(source.defaultReasoningEffort)
      ? source.defaultReasoningEffort
      : "",
    defaultModel,
    models,
    modelCapabilities,
    modelOverrides: normalizeModelOverrides(source.modelOverrides, models),
    enabled: source.enabled !== false,
    maxTokens: clampInt(source.maxTokens, 1, 1000000, 8192),
    contextWindow: clampInt(source.contextWindow, 1, 10000000, LIMITS.defaultContextWindow),
    temperature: clampNumber(source.temperature, 0, 2, 0.7),
    topP: clampNumber(source.topP, 0, 1, 1),
    streaming: source.streaming !== false,
    saveChats: source.saveChats !== false,
    systemPrompt: cleanString(source.systemPrompt, LIMITS.messageChars),
    userId: cleanString(source.userId, 200),
    hasKeyConfigured: source.hasKeyConfigured === true
  };
}

/** 会话内只读供应商快照：即使供应商被删除，对话仍可回放与重绑。 */
export function snapshotProvider(provider) {
  const normalized = normalizeProvider(provider);
  return {
    displayName: normalized.displayName,
    baseUrl: normalized.baseUrl,
    responseFormat: normalized.responseFormat,
    defaultReasoningEffort: normalized.defaultReasoningEffort,
    defaultModel: normalized.defaultModel,
    contextWindow: normalized.contextWindow,
    maxTokens: normalized.maxTokens
  };
}

export function providerSnapshotEqual(a, b) {
  return Boolean(
    a && b &&
    a.displayName === b.displayName &&
    a.baseUrl === b.baseUrl &&
    a.responseFormat === b.responseFormat
  );
}

// ---- 消息 ----

export function normalizeMessageUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const inputTokens = Math.max(0, Math.floor(Number(usage.inputTokens) || 0));
  const outputTokens = Math.max(0, Math.floor(Number(usage.outputTokens) || 0));
  const totalTokens = Math.max(0, Math.floor(Number(usage.totalTokens) || (inputTokens + outputTokens)));
  if (!inputTokens && !outputTokens && !totalTokens) return null;
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimated: usage.estimated === true
  };
}

/** 模型输出图片：白名单 + 限额（单条 ≤4 张、单张 ≤20MB、合计 ≤80MB）。 */
export function normalizeOutputImages(images) {
  if (!Array.isArray(images)) return [];
  const kept = [];
  let total = 0;
  for (const image of images) {
    if (kept.length >= LIMITS.imagesPerMessage) break;
    const source = image && typeof image === "object" ? String(image.source || "") : "";
    if (!isSafeImageSource(source)) continue;
    const size = imageByteSize(source);
    if (size > LIMITS.imageBytes) continue;
    if (total + size > LIMITS.imagesTotalBytes) break;
    total += size;
    kept.push({
      type: "image",
      source,
      mimeType: IMAGE_MIME_TYPES.includes(image.mimeType) ? image.mimeType : "image/png",
      alt: cleanString(image.alt, 300) || "模型生成的图片"
    });
  }
  return kept;
}

/** 模型输出文件（音频/视频/PDF/其他）：白名单 + 限额（单条 ≤8 个、单个 ≤20MB、合计 ≤80MB）。 */
export function normalizeOutputFiles(files) {
  if (!Array.isArray(files)) return [];
  const kept = [];
  const seen = new Set();
  let total = 0;
  for (const file of files) {
    if (kept.length >= LIMITS.filesPerMessage) break;
    const source = file && typeof file === "object" ? String(file.source || "") : "";
    if (!isSafeFileSource(source)) continue;
    const name = cleanString(file.name, 200) || "文件";
    const identity = `${name}\u0000${source}`;
    if (seen.has(identity)) continue;
    const size = Number(file.size) > 0 ? Number(file.size) : fileByteSize(source);
    if (size > LIMITS.fileBytes) continue;
    if (total + size > LIMITS.filesTotalBytes) break;
    seen.add(identity);
    total += size;
    kept.push({
      type: "file",
      name,
      mimeType: cleanString(file.mimeType, 120) || "application/octet-stream",
      source,
      size,
      ...(Number.isFinite(Number(file.contentOffset)) ? {
        contentOffset: Math.max(0, Math.min(10 * 1024 * 1024, Math.floor(Number(file.contentOffset))))
      } : {}),
      ...(file.artifactId ? { artifactId: cleanString(file.artifactId, 240) } : {}),
      ...(file.callId ? { callId: cleanString(file.callId, 120) } : {})
    });
  }
  return kept;
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .filter((file) => file && typeof file === "object")
    .map((file) => ({
      name: cleanString(file.name, 200).trim() || "未命名文件",
      text: cleanString(file.text)
    }))
    .filter((file) => file.text.length > 0)
    .slice(0, 32);
}

const RENAMED_RUNTIME_TOOLS = Object.freeze({
  tribblebook_run_command: "clawbox_run_command",
  tribblebook_code_interpreter: "clawbox_code_interpreter"
});

function normalizeToolPart(part) {
  const skillApplied = part.type === "skill_applied" || part.source === "skill";
  const status = ["requested", "running", "succeeded", "failed", "cancelled", "applied"].includes(part.status)
    ? part.status
    : skillApplied ? "applied" : "succeeded";
  const content = (Array.isArray(part.content) ? part.content : [])
    .filter((block) => block && (block.type === "text" || block.type === "json"))
    .map((block) => {
      let text;
      if (block.type === "json") {
        const value = block.json ?? block.data ?? block.value ?? block.text ?? null;
        try {
          text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
        } catch {
          text = String(value ?? "");
        }
      } else {
        text = String(block.text ?? block.value ?? "");
      }
      return { type: block.type, text: cleanString(text, 32 * 1024) };
    })
    .filter((block) => block.text);
  const rawName = cleanString(part.name, 120);
  return {
    type: skillApplied ? "skill_applied" : part.type === "tool_call" ? "tool_call" : "tool_result",
    callId: cleanString(part.callId, 120) || createId(),
    name: RENAMED_RUNTIME_TOOLS[rawName] || rawName || (skillApplied ? "未命名 Skill" : "未命名工具"),
    source: skillApplied ? "skill" : part.source === "sandbox" ? "sandbox" : "tool",
    status,
    input: cleanString(part.input, 8 * 1024),
    output: cleanString(part.output, 32 * 1024),
    content,
    // 可选展示锚点；旧消息没有该字段时归零，继续在正文前显示。
    contentOffset: Math.max(0, Math.min(10 * 1024 * 1024, Math.floor(Number(part.contentOffset) || 0))),
    durationMs: Math.max(0, Math.min(10 * 60 * 1000, Math.floor(Number(part.durationMs) || 0)))
  };
}

function normalizeRuntimeImageCandidate(image) {
  if (!image || typeof image !== "object") return null;
  const sourceObject = image.source && typeof image.source === "object" ? image.source : null;
  const imageUrl = image.image_url && typeof image.image_url === "object" ? image.image_url.url : image.image_url;
  const mimeType = IMAGE_MIME_TYPES.includes(image.mimeType)
    ? image.mimeType
    : IMAGE_MIME_TYPES.includes(image.mime_type)
      ? image.mime_type
      : IMAGE_MIME_TYPES.includes(sourceObject?.media_type) ? sourceObject.media_type : "image/png";
  const raw = String(sourceObject?.data || sourceObject?.url || image.source || image.data || imageUrl || image.url || image.b64_json || "").trim();
  const source = isSafeImageSource(raw)
    ? raw
    : /^[A-Za-z0-9+/]+={0,2}$/.test(raw.replace(/\s/g, "")) && raw.length >= 4
      ? `data:${mimeType};base64,${raw.replace(/\s/g, "")}`
      : "";
  if (!source) return null;
  return {
    source,
    mimeType,
    alt: cleanString(image.alt || image.name, 300) || "工具返回的图片"
  };
}

function runtimePartImages(part) {
  const blocks = Array.isArray(part.content) ? part.content : [];
  const candidates = [
    ...blocks.filter((block) => block && block.type === "image"),
    ...(Array.isArray(part.images) ? part.images : [])
  ];
  return candidates.map(normalizeRuntimeImageCandidate).filter(Boolean);
}

function normalizeParts(parts) {
  if (!Array.isArray(parts)) return [];
  const kept = [];
  let imageCount = 0;
  let totalBytes = 0;
  let fileCount = 0;
  let fileBytes = 0;
  const keepImage = (image) => {
    if (imageCount >= LIMITS.imagesPerMessage) return;
    const source = String(image.source || "");
    if (!isSafeImageSource(source)) return;
    const size = imageByteSize(source);
    if (size > LIMITS.imageBytes || totalBytes + size > LIMITS.imagesTotalBytes) return;
    imageCount += 1;
    totalBytes += size;
    kept.push({
      type: "image",
      source,
      mimeType: IMAGE_MIME_TYPES.includes(image.mimeType) ? image.mimeType : "image/png",
      alt: cleanString(image.alt, 300) || "图片"
    });
  };
  const keepFile = (file) => {
    if (fileCount >= LIMITS.filesPerMessage) return;
    const source = String(file.source || "");
    if (!isSafeFileSource(source)) return;
    const size = Number(file.size) > 0 ? Number(file.size) : fileByteSize(source);
    if (size > LIMITS.fileBytes || fileBytes + size > LIMITS.filesTotalBytes) return;
    fileCount += 1;
    fileBytes += size;
    kept.push({
      type: "file",
      name: cleanString(file.name, 200) || "文件",
      mimeType: cleanString(file.mimeType, 120) || "application/octet-stream",
      source,
      size,
      ...(Number.isFinite(Number(file.contentOffset)) ? {
        contentOffset: Math.max(0, Math.min(10 * 1024 * 1024, Math.floor(Number(file.contentOffset))))
      } : {}),
      ...(file.artifactId ? { artifactId: cleanString(file.artifactId, 240) } : {}),
      ...(file.callId ? { callId: cleanString(file.callId, 120) } : {})
    });
  };
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    if (part.type === "text") {
      const text = cleanString(part.text);
      if (text) kept.push({ type: "text", text });
      continue;
    }
    if (part.type === "image") {
      keepImage(part);
      continue;
    }
    if (part.type === "file") {
      keepFile(part);
      continue;
    }
    if (part.type === "tool_call" || part.type === "tool_result" || part.type === "skill_applied") {
      kept.push(normalizeToolPart(part));
      runtimePartImages(part).forEach(keepImage);
      continue;
    }
    // 预留类型（video/audio/tool_call/tool_result/artifact）与未知类型：原样保留，渲染为紧凑提示。
    kept.push({ ...part });
  }
  // 最多 16 个 Skill + 8 次调用的 requested/result 生命周期 + 4 张图片 + 8 个文件，
  // 另留少量兼容空间；避免归档归一化把已完成结果从消息尾部截掉。
  return kept.slice(0, 56);
}

function normalizeSkippedAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      name: cleanString(item.name, 200) || "文件",
      mimeType: cleanString(item.mimeType, 120) || "application/octet-stream",
      reason: cleanString(item.reason, 200) || "未发送"
    }))
    .slice(0, 8);
}

export function normalizeMessage(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const role = source.role === "assistant" ? "assistant" : "user";
  const message = {
    id: String(source.id || createId()),
    // Tree metadata is optional on legacy records; normalizeConversation
    // assigns the deterministic linear parent chain when it is absent.
    parentId: source.parentId == null || source.parentId === "" ? null : String(source.parentId),
    role,
    content: cleanString(source.content),
    ...(typeof source.contextText === 'string' ? { contextText: source.contextText } : {}),
    ...(source.outputSurface === 'workspace' ? { outputSurface: 'workspace' } : {}),
    reasoning: cleanString(source.reasoning),
    reasoningKind: source.reasoningKind === "summary" ? "summary" : "thinking",
    files: normalizeFiles(source.files),
    parts: normalizeParts(source.parts),
    skippedAttachments: normalizeSkippedAttachments(source.skippedAttachments),
    usage: normalizeMessageUsage(source.usage),
    error: source.error ? cleanString(source.error, 4000) : "",
    stopped: source.stopped === true,
    createdAt: Number(source.createdAt) > 0 ? Number(source.createdAt) : Date.now(),
    durationMs: Math.max(0, Math.floor(Number(source.durationMs) || 0)),
    reasoningMs: Math.max(0, Math.floor(Number(source.reasoningMs) || 0)),
    noticeKind: source.noticeKind === "context-compress" ? "context-compress" : "",
    noticeState: ["running", "done", "error"].includes(source.noticeState) ? source.noticeState : ""
  };
  if (!message.content && !message.parts.length && !message.files.length && !message.error) {
    message.content = "";
  }
  return message;
}

// ---- 上下文压缩 ----

export function normalizeContextCompression(raw) {
  if (!raw || typeof raw !== "object") return null;
  const summary = cleanString(raw.summary, LIMITS.summaryChars);
  if (!summary.trim() || !raw.throughMessageId) return null;
  return {
    summary,
    throughMessageId: String(raw.throughMessageId),
    sourceMessageCount: Math.max(0, Math.floor(Number(raw.sourceMessageCount) || 0)),
    model: cleanString(raw.model, 200),
    createdAt: Number(raw.createdAt) > 0 ? Number(raw.createdAt) : Date.now()
  };
}

// ---- 会话 ----

const EFFORT_KEYS = EFFORT_LEVELS.map((level) => level.key);

export function normalizeConversation(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const rawMessageList = Array.isArray(source.messages) ? source.messages : [];
  const messageObjects = rawMessageList.filter((message) => message && typeof message === "object");
  const explicitParentFlags = messageObjects.map((message) => Object.prototype.hasOwnProperty.call(message, "parentId"));
  // A wholly legacy array has no topology metadata at all. Treat it as one
  // linear path even if a stale empty selection object was attached by an
  // older migration. When a tree is present, an omitted parent on an
  // individual legacy node is inferred from creation order while explicit
  // parent links (including null roots) remain authoritative.
  const hasAnyParentMetadata = explicitParentFlags.some(Boolean);
  const hasTreeMetadata = hasAnyParentMetadata || Boolean(source.activeRootMessageId) || Boolean(source.activeChildByMessageId);
  const rawMessages = messageObjects
    .map((rawMessage, index) => ({
      message: normalizeMessage(rawMessage),
      hasParent: explicitParentFlags[index]
    }))
    .filter(({ message }) => message.role === "user" || message.role === "assistant");
  const messages = [];
  const seenIds = new Set();
  let duplicateId = false;
  for (const entry of rawMessages) {
    const message = entry.message;
    // Message IDs are used as React keys and tree references. Keep imported
    // duplicates addressable instead of silently collapsing one node.
    if (seenIds.has(message.id)) {
      duplicateId = true;
      let replacement = createId();
      while (seenIds.has(replacement)) replacement = createId();
      message.id = replacement;
    }
    const previous = messages[messages.length - 1] || null;
    if (!hasTreeMetadata || duplicateId || !entry.hasParent) {
      message.parentId = previous ? previous.id : null;
    } else if (message.parentId != null && (message.parentId === message.id || !seenIds.has(message.parentId))) {
      // A parent must precede its child in the persisted creation order. An
      // invalid reference is made reachable through the previous node.
      message.parentId = previous ? previous.id : null;
    }
    seenIds.add(message.id);
    messages.push(message);
  }
  if (duplicateId) {
    // A duplicate makes parent references ambiguous (a child may point at
    // either occurrence).  Linearize the complete creation order so every
    // node remains reachable and the fallback is deterministic.
    messages.forEach((message, index) => {
      message.parentId = index ? messages[index - 1].id : null;
    });
  }
  if (source.writing) migrateWritingMessages(messages);
  const roots = messages.filter((message) => message.parentId == null);
  const rawSelections = source.activeChildByMessageId && typeof source.activeChildByMessageId === "object"
    ? source.activeChildByMessageId
    : {};
  const activeChildByMessageId = Object.create(null);
  for (const parent of messages) {
    const children = messages.filter((message) => message.parentId === parent.id);
    if (!children.length) continue;
    const rawSelected = Object.prototype.hasOwnProperty.call(rawSelections, parent.id)
      ? rawSelections[parent.id]
      : "";
    const selected = typeof rawSelected === "string" || typeof rawSelected === "number"
      ? String(rawSelected)
      : "";
    activeChildByMessageId[parent.id] = children.some((child) => child.id === selected)
      ? selected
      : children[children.length - 1].id;
  }
  const activeRootMessageId = roots.some((message) => message.id === String(source.activeRootMessageId || ""))
    ? String(source.activeRootMessageId)
    : (roots[roots.length - 1]?.id || "");
  const createdAt = Number(source.createdAt) > 0 ? Number(source.createdAt) : Date.now();
  return {
    id: String(source.id || createId()),
    title: cleanString(source.title, 120).trim(),
    titleGenerationAttempted: source.titleGenerationAttempted === true || messages.some(message => !message.noticeKind),
    createdAt,
    updatedAt: Number(source.updatedAt) > 0 ? Number(source.updatedAt) : createdAt,
    pinned: source.pinned === true,
    writing: normalizeWork(source.writing),
    isTemporary: source.isTemporary === true && !source.writing && !messages.some((message) => message.role === "user"),
    projectId: typeof source.projectId === "string" && source.projectId ? source.projectId : null,
    providerId: String(source.providerId || ""),
    providerSnapshot: source.providerSnapshot && typeof source.providerSnapshot === "object"
      ? snapshotProvider(source.providerSnapshot)
      : null,
    model: cleanString(source.model, 200),
    // 历史数据可能存有已移除的 none 档，回落到最低档 low
    reasoningEffort: source.reasoningEffort === "none"
      ? "low"
      : EFFORT_KEYS.includes(source.reasoningEffort) ? source.reasoningEffort : "medium",
    reasoningEffortOverride: EFFORT_KEYS.includes(source.reasoningEffortOverride) ? source.reasoningEffortOverride : null,
    saveChats: source.saveChats !== false,
    contextCompression: normalizeContextCompression(source.contextCompression),
    extensionSelection: normalizeExtensionSelection(source.extensionSelection),
    messages,
    activeRootMessageId,
    activeChildByMessageId,
    draft: cleanString(source.draft, LIMITS.draftChars),
    imported: source.imported === true
  };
}
