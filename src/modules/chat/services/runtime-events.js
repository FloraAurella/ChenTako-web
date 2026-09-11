import { normalizeProviderFileSource, normalizeProviderImageSource } from "../../connections/public/domain_adapters.js";

const MAX_PERSISTED_RUNTIME_EVENTS = 48;

function serialize(value, maxChars) {
  if (typeof value === "string") return value.slice(0, maxChars);
  try { return JSON.stringify(value, null, 2).slice(0, maxChars); } catch { return String(value ?? "").slice(0, maxChars); }
}

function normalizeImage(image) {
  if (!image || typeof image !== "object") return null;
  const sourceObject = image.source && typeof image.source === "object" ? image.source : null;
  const imageUrl = image.image_url && typeof image.image_url === "object" ? image.image_url.url : image.image_url;
  const mimeType = String(image.mimeType || image.mime_type || sourceObject?.media_type || "image/png");
  const source = normalizeProviderImageSource(sourceObject?.data || sourceObject?.url || image.source || image.data || imageUrl || image.url || image.b64_json || "", mimeType);
  return source ? { source, mimeType, alt: String(image.alt || image.name || "工具返回的图片").slice(0, 300) } : null;
}

function normalizeFile(block) {
  if (!block || typeof block !== "object") return null;
  const sourceObject = block.source && typeof block.source === "object" ? block.source : null;
  const rawMime = block.mimeType || block.mime_type || sourceObject?.media_type || "";
  const source = normalizeProviderFileSource(sourceObject?.data || sourceObject?.url || block.source || block.data || block.url || "", rawMime);
  return source ? {
    name: String(block.name || block.filename || "工具返回的文件").slice(0, 200),
    mimeType: String(rawMime || (source.startsWith("data:") ? source.slice(5, source.indexOf(";")) : "application/octet-stream")).split(";")[0].trim() || "application/octet-stream",
    source,
    size: Number(block.size) > 0 ? Number(block.size) : Math.round(source.length * 0.75)
  } : null;
}

function contentOf(event) {
  const content = [];
  const images = [];
  const files = [];
  for (const block of (Array.isArray(event?.content) ? event.content : []).slice(0, 16)) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "image") { const image = normalizeImage(block); if (image) images.push(image); continue; }
    if (block.type === "file") { const file = normalizeFile(block); if (file) files.push(file); continue; }
    if (block.type === "json") { content.push({ type: "json", text: serialize(block.json ?? block.data ?? block.value ?? block.text ?? null, 32 * 1024) }); continue; }
    if (block.type === "text") { const text = serialize(block.text ?? block.value ?? "", 32 * 1024); if (text) content.push({ type: "text", text }); }
  }
  for (const entry of (Array.isArray(event?.images) ? event.images : []).slice(0, 4)) { const image = normalizeImage(entry); if (image) images.push(image); }
  for (const entry of (Array.isArray(event?.files) ? event.files : []).slice(0, 8)) { const file = normalizeFile(entry); if (file) files.push(file); }
  return { content, images, files };
}

function lifecycleKey(event, index) {
  if (event?.type === "skill_applied" || event?.source === "skill") {
    return `skill:${String(event?.skillId || event?.name || index)}`;
  }
  const callId = String(event?.callId || "").trim();
  return callId ? `call:${callId}` : `event:${index}`;
}

/**
 * Provider 与本地执行器会依次发送 requested/running/result。UI 只保留一个稳定
 * 条目并用后到事件补齐它，既维持首次出现顺序，也避免完成时堆出重复卡片。
 */
function mergeLifecycles(events) {
  const merged = [];
  const indexes = new Map();
  for (const [index, raw] of events.slice(0, 160).entries()) {
    if (!raw || typeof raw !== "object") continue;
    const key = lifecycleKey(raw, index);
    const existingIndex = indexes.get(key);
    if (existingIndex === undefined) {
      indexes.set(key, merged.length);
      merged.push({ ...raw });
      continue;
    }
    const previous = merged[existingIndex];
    const nextContent = Array.isArray(raw.content) && raw.content.length ? raw.content : previous.content;
    merged[existingIndex] = {
      ...previous,
      ...raw,
      // requested/running/result 始终更新第一次出现的位置，不随后续正文漂到末尾。
      contentOffset: previous.contentOffset ?? raw.contentOffset,
      input: raw.input === undefined || raw.input === "" ? previous.input : raw.input,
      output: raw.output === undefined || raw.output === "" ? previous.output : raw.output,
      ...(nextContent ? { content: nextContent } : {})
    };
  }
  return merged.slice(0, MAX_PERSISTED_RUNTIME_EVENTS);
}

/** Converts untrusted extension lifecycle events into bounded message parts and media. */
export function normalizeToolEvents(events) {
  if (!Array.isArray(events)) return { parts: [], images: [], files: [] };
  const images = [];
  const files = [];
  const parts = mergeLifecycles(events).map((event, index) => {
    const declared = ["sandbox", "skill"].includes(event?.source) ? event.source : "tool";
    const skill = event?.type === "skill_applied" || declared === "skill";
    const normalized = contentOf(event);
    images.push(...normalized.images);
    const callId = String(event?.callId || `call-${index + 1}`).slice(0, 120);
    files.push(...normalized.files.map((file, fileIndex) => ({
      ...file,
      artifactId: `${callId}:${fileIndex}`.slice(0, 240),
      callId,
      contentOffset: Math.max(0, Math.floor(Number(event?.contentOffset) || 0))
    })));
    const status = skill ? "applied" : ["requested", "running", "succeeded", "failed", "cancelled"].includes(event?.status) ? event.status : "failed";
    const output = serialize(event?.output ?? "", 32 * 1024) || normalized.content.map((block) => block.text).filter(Boolean).join("\n\n");
    return {
      type: skill ? "skill_applied" : ["requested", "running"].includes(status) ? "tool_call" : "tool_result",
      callId,
      name: String(event?.name || (skill ? "未命名 Skill" : "未命名工具")).slice(0, 120),
      source: skill ? "skill" : declared,
      status,
      input: serialize(event?.input ?? "", 8 * 1024),
      output,
      content: normalized.content,
      contentOffset: Math.max(0, Math.floor(Number(event?.contentOffset) || 0)),
      durationMs: Math.max(0, Math.min(10 * 60 * 1000, Math.floor(Number(event?.durationMs) || 0)))
    };
  });
  return { parts, images, files };
}
