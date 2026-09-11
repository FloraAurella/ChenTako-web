"use strict";

/**
 * 四种上游协议适配（与 backend/src/lib/upstream.ts 的归一化逻辑对齐）：
 * Responses / Anthropic Messages / OpenAI Chat Completions / Google Gemini →
 * 统一 { reasoning, content, images, reasoningKind, usage }。
 */


const KNOWN_FORMATS = ["responses", "anthropic", "openai-compatible", "google"];
const THINK_OPEN_TAG = "<think>";
const THINK_CLOSE_TAG = "</think>";
const OUTPUT_FILE_TYPES = new Set(["document", "file", "audio", "output_audio", "output_file", "file_url"]);

function normalizeFormat(value) {
  return KNOWN_FORMATS.includes(value) ? value : "openai-compatible";
}

function safeText(value) {
  return typeof value === "string" ? value : String(value ?? "");
}

function combineReasoning(nativeReasoning, taggedReasoning) {
  const nativeText = safeText(nativeReasoning);
  const taggedText = safeText(taggedReasoning);
  if (!nativeText) return taggedText;
  if (!taggedText) return nativeText;
  const nativeTrimmed = nativeText.trim();
  const taggedTrimmed = taggedText.trim();
  if (!nativeTrimmed) return taggedText;
  if (!taggedTrimmed) return nativeText;
  if (nativeTrimmed === taggedTrimmed || nativeTrimmed.includes(taggedTrimmed)) return nativeText;
  if (taggedTrimmed.includes(nativeTrimmed)) return taggedText;
  return `${nativeText}\n\n${taggedText}`;
}

function syncReasoning(acc) {
  acc.reasoning = combineReasoning(acc.nativeReasoning, acc.taggedReasoning);
  if (!acc.nativeReasoning && acc.taggedReasoning) acc.reasoningKind = "thinking";
}

function appendNativeReasoning(acc, value, kind = "thinking") {
  const text = safeText(value);
  if (!text) return;
  acc.nativeReasoning += text;
  acc.reasoningKind = kind;
  syncReasoning(acc);
}

function appendTaggedReasoning(acc, value) {
  const text = safeText(value);
  if (!text) return;
  acc.taggedReasoning += text;
  syncReasoning(acc);
}

function tagPrefixAtEnd(value, tag) {
  const lower = value.toLowerCase();
  for (let length = Math.min(lower.length, tag.length - 1); length > 0; length -= 1) {
    if (lower.endsWith(tag.slice(0, length))) return length;
  }
  return 0;
}

/**
 * 把正文里的 <think>...</think> 兼容格式拆进思考区。状态机只暂存可能
 * 组成标签的末尾字符，因此普通正文仍会立即增量显示；标签本身可以跨任意
 * SSE chunk。final=true 时，未闭合的 think 块按思考内容安全收口。
 */
function appendThinkAwareContent(acc, value, final = false) {
  const state = acc.thinkTagState;
  state.buffer += safeText(value);

  while (state.buffer) {
    const tag = state.mode === "thinking" ? THINK_CLOSE_TAG : THINK_OPEN_TAG;
    const index = state.buffer.toLowerCase().indexOf(tag);
    if (index >= 0) {
      const text = state.buffer.slice(0, index);
      if (state.mode === "thinking") appendTaggedReasoning(acc, text);
      else acc.content += text;
      state.buffer = state.buffer.slice(index + tag.length);
      state.mode = state.mode === "thinking" ? "content" : "thinking";
      continue;
    }

    const keep = final ? 0 : tagPrefixAtEnd(state.buffer, tag);
    const text = state.buffer.slice(0, state.buffer.length - keep);
    if (state.mode === "thinking") appendTaggedReasoning(acc, text);
    else acc.content += text;
    state.buffer = keep ? state.buffer.slice(-keep) : "";
    break;
  }

  if (final) {
    state.mode = "content";
    state.buffer = "";
  }
}

function applyThinkTagCompatibility(result) {
  const holder = {
    content: "",
    reasoning: "",
    nativeReasoning: safeText(result.reasoning),
    taggedReasoning: "",
    reasoningKind: result.reasoningKind,
    thinkTagState: { mode: "content", buffer: "" }
  };
  appendThinkAwareContent(holder, result.content, true);
  syncReasoning(holder);
  result.content = holder.content;
  result.reasoning = holder.reasoning;
  result.reasoningKind = holder.reasoningKind;
  return result;
}

function imageMimeType(value) {
  const mime = safeText(value || "image/png").toLowerCase();
  if (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime)) return mime;
  return "image/png";
}

/**
 * 统一图片源：Responses 与不少兼容端点会返回裸 base64，而浏览器持久化层只
 * 接收安全 data URL / HTTPS。这里在进入 accumulator 前补齐 data URL，避免
 * 生成结果在最终归一化时被静默过滤。
 */
export function normalizeProviderImageSource(value, mimeType = "image/png") {
  const source = safeText(value).trim();
  if (!source) return "";
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(source)) return source;
  if (/^https?:\/\//i.test(source)) return source;
  const base64 = source.replace(/\s/g, "");
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(base64) && base64.length >= 4) {
    return `data:${imageMimeType(mimeType)};base64,${base64}`;
  }
  return source;
}

function imageValue(value) {
  if (value && typeof value === "object") {
    return value.url || value.data || value.b64_json || "";
  }
  return value;
}

function fileMimeType(value, fallback = "application/octet-stream") {
  const mime = safeText(value).split(";")[0].trim().toLowerCase();
  return mime || fallback;
}

/** 与 normalizeProviderImageSource 同构的非图片文件源归一化。 */
export function normalizeProviderFileSource(value, mimeType) {
  const source = safeText(value).trim();
  if (!source) return "";
  if (/^data:[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*;base64,/i.test(source)) return source;
  if (/^https?:\/\//i.test(source)) return source;
  const base64 = source.replace(/\s/g, "");
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(base64) && base64.length >= 4) {
    return `data:${fileMimeType(mimeType)};base64,${base64}`;
  }
  return "";
}

function fileByteSizeOf(source) {
  const match = String(source).match(/^data:[^,]+;base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return String(source).length;
  const encoded = match[1].replace(/\s/g, "");
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(encoded.length * 0.75) - padding);
}

function extractFilesFromBlocks(blocks) {
  const files = [];
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (!block || !OUTPUT_FILE_TYPES.has(block.type)) continue;
    const sourceObject = block.source && typeof block.source === "object" ? block.source : null;
    const fileData = block.file_data && typeof block.file_data === "object" ? block.file_data : null;
    const rawSource = sourceObject?.data || sourceObject?.url || block.data || block.url ||
      block.file_url || block.result || fileData?.fileUri || fileData?.url || "";
    const rawMime = block.mimeType || block.mime_type || sourceObject?.media_type ||
      fileData?.mimeType || fileData?.mime_type || "";
    const source = normalizeProviderFileSource(rawSource, rawMime);
    if (!source) continue;
    files.push({
      name: safeText(block.name || block.filename || "模型返回的文件").slice(0, 200),
      mimeType: fileMimeType(rawMime, source.startsWith("data:") ? source.slice(5, source.indexOf(";")) : "application/octet-stream"),
      source,
      size: Number(block.size) > 0 ? Number(block.size) : fileByteSizeOf(source)
    });
  }
  return files;
}

/** 提取四种协议的非图片文件输出（与后端 normalizeUpstreamJson 对称）。 */
export function extractProviderOutputFiles(payload, format = "openai-compatible") {
  if (!payload || typeof payload !== "object") return [];
  if (format === "anthropic") {
    return extractFilesFromBlocks(Array.isArray(payload.content) ? payload.content : []);
  }
  if (format === "responses") {
    return extractFilesFromBlocks(Array.isArray(payload.output) ? payload.output : []);
  }
  if (format === "google") {
    const candidate = payload.candidates && payload.candidates[0];
    const content = candidate && candidate.content;
    const parts = content && Array.isArray(content.parts) ? content.parts : [];
    const files = [];
    for (const part of parts) {
      if (!part || typeof part !== "object") continue;
      const inline = part.inlineData && typeof part.inlineData === "object" ? part.inlineData : null;
      const fileData = part.fileData && typeof part.fileData === "object" ? part.fileData : null;
      if (inline && !/^image\//i.test(safeText(inline.mimeType))) {
        const source = normalizeProviderFileSource(inline.data, inline.mimeType);
        if (source) {
          files.push({
            name: safeText(part.name || "模型返回的文件").slice(0, 200),
            mimeType: fileMimeType(inline.mimeType),
            source,
            size: Number(part.size) > 0 ? Number(part.size) : fileByteSizeOf(source)
          });
        }
      } else if (fileData) {
        const source = normalizeProviderFileSource(fileData.fileUri || fileData.url, fileData.mimeType);
        if (source) {
          files.push({
            name: safeText(part.name || "模型返回的文件").slice(0, 200),
            mimeType: fileMimeType(fileData.mimeType),
            source,
            size: Number(part.size) > 0 ? Number(part.size) : fileByteSizeOf(source)
          });
        }
      }
    }
    return files;
  }
  const message = (payload.choices && payload.choices[0] && payload.choices[0].message) || payload.message || payload;
  return extractFilesFromBlocks(Array.isArray(message.content) ? message.content : []);
}

function normalizeUsageObject(usage) {
  if (!usage || typeof usage !== "object") return null;
  const inputTokens = Math.max(0, Math.floor(Number(
    usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens ?? usage.promptTokenCount ?? 0
  ) || 0));
  const outputTokens = Math.max(0, Math.floor(Number(
    usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens ?? usage.candidatesTokenCount ?? 0
  ) || 0));
  const totalTokens = Math.max(0, Math.floor(Number(
    usage.total_tokens ?? usage.totalTokens ?? usage.totalTokenCount ?? (inputTokens + outputTokens)
  ) || 0));
  if (!inputTokens && !outputTokens && !totalTokens) return null;
  return {
    inputTokens,
    outputTokens,
    totalTokens: Math.max(inputTokens + outputTokens, totalTokens),
    estimated: false
  };
}

// ---- 非流式响应归一化 ----

function extractAnthropicImages(blocks) {
  return (Array.isArray(blocks) ? blocks : [])
    .filter((block) => block && block.type === "image" && block.source && typeof block.source === "object")
    .map((block) => ({
      source: block.source.data
        ? normalizeProviderImageSource(block.source.data, block.source.media_type)
        : normalizeProviderImageSource(block.source.url, block.source.media_type),
      mimeType: imageMimeType(block.source.media_type || "image/png"),
      alt: safeText(block.alt || "模型返回的图片")
    }));
}

function extractResponsesImages(output) {
  return (Array.isArray(output) ? output : [])
    .filter((item) => item && (item.type === "image_generation_call" || item.type === "image"))
    .map((item) => ({
      source: normalizeProviderImageSource(item.result || imageValue(item.image_url) || item.url || item.b64_json || "", item.mime_type),
      mimeType: imageMimeType(item.mime_type || "image/png"),
      alt: safeText(item.revised_prompt || "模型生成的图片")
    }));
}

function extractCompatibleImages(message) {
  if (!message || typeof message !== "object") return [];
  const blocks = Array.isArray(message.content) ? message.content : [];
  const fromBlocks = blocks
    .filter((block) => block && ["image", "image_url", "output_image"].includes(block.type))
    .map((block) => ({
      source: normalizeProviderImageSource(
        (block.image_url && typeof block.image_url === "object" ? block.image_url.url : "") ||
        block.image_url || block.url || (block.source && block.source.data) || block.b64_json || "",
        block.mime_type || (block.source && block.source.media_type) || "image/png"
      ),
      mimeType: imageMimeType(block.mime_type || (block.source && block.source.media_type) || "image/png"),
      alt: safeText(block.alt || "模型返回的图片")
    }));
  const extra = (Array.isArray(message.images) ? message.images : []).map((image) => ({
    ...image,
    source: normalizeProviderImageSource(image && image.source, image && image.mimeType),
    mimeType: imageMimeType(image && image.mimeType)
  }));
  return [...fromBlocks, ...extra];
}

export function extractProviderOutputImages(payload, format = "openai-compatible") {
  if (!payload || typeof payload !== "object") return [];
  if (format === "anthropic") {
    return extractAnthropicImages(Array.isArray(payload.content) ? payload.content : []);
  }
  if (format === "responses") {
    return extractResponsesImages(Array.isArray(payload.output) ? payload.output : []);
  }
  if (format === "google") {
    const candidate = payload.candidates && payload.candidates[0];
    const content = candidate && candidate.content;
    const parts = content && Array.isArray(content.parts) ? content.parts : [];
    return parts
      .filter((part) => part && part.inlineData && typeof part.inlineData === "object")
      .map((part) => ({
        source: normalizeProviderImageSource(part.inlineData.data, part.inlineData.mimeType),
        mimeType: imageMimeType(part.inlineData.mimeType || "image/png"),
        alt: safeText(part.alt || "模型返回的图片")
      }));
  }
  const message = (payload.choices && payload.choices[0] && payload.choices[0].message) || payload.message || payload;
  return extractCompatibleImages(message);
}

function normalizeTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item) => item && (item.type === "text" || item.type === "output_text"))
    .map((item) => safeText(item.text))
    .join("\n\n");
}

function responseRuntimeEvents(payload) {
  if (Array.isArray(payload?.extensionEvents)) return payload.extensionEvents;
  return [
    ...(Array.isArray(payload?.skillEvents) ? payload.skillEvents : []),
    ...(Array.isArray(payload?.toolEvents) ? payload.toolEvents : [])
  ];
}

export function normalizeProviderResponse(payload, format = "openai-compatible") {
  const kind = normalizeFormat(format);
  const result = {
    reasoning: "",
    content: "",
    images: [],
    files: [],
    reasoningKind: kind === "responses" ? "summary" : "thinking",
    usage: normalizeUsageObject(payload && payload.usage),
    skippedAttachments: Array.isArray(payload && payload.skippedAttachments) ? payload.skippedAttachments : [],
    toolEvents: []
  };
  if (!payload || typeof payload !== "object") return result;

  // Clawbox 后端在非流式（以及 Tool 回合）返回的是统一载荷，不再是上游原始
  // Responses/Anthropic/OpenAI JSON。先识别它，避免被各协议解析器重新误读。
  if (!Array.isArray(payload.output) && !Array.isArray(payload.choices) &&
    typeof payload.content === "string" &&
    ("reasoningKind" in payload || Array.isArray(payload.images) ||
      Array.isArray(payload.toolEvents) || Array.isArray(payload.skillEvents) ||
      Array.isArray(payload.extensionEvents))) {
    result.reasoning = safeText(payload.reasoning);
    result.content = payload.content;
    result.images = Array.isArray(payload.images)
      ? payload.images.map((image) => ({
          source: normalizeProviderImageSource(image && image.source, image && image.mimeType),
          mimeType: imageMimeType(image && image.mimeType),
          alt: safeText(image && image.alt || "模型生成的图片")
        }))
      : [];
    result.files = Array.isArray(payload.files)
      ? payload.files.map((file) => {
          const source = normalizeProviderFileSource(file && file.source, file && file.mimeType);
          return {
            name: safeText(file && file.name || "模型返回的文件").slice(0, 200),
            mimeType: fileMimeType(file && file.mimeType),
            source,
            size: Number(file && file.size) > 0 ? Number(file.size) : fileByteSizeOf(source)
          };
        }).filter((file) => file.source)
      : [];
    result.skippedAttachments = Array.isArray(payload.skippedAttachments) ? payload.skippedAttachments : [];
    result.reasoningKind = payload.reasoningKind === "summary" ? "summary" : "thinking";
    result.usage = normalizeUsageObject(payload.usage);
    result.toolEvents = responseRuntimeEvents(payload);
    return applyThinkTagCompatibility(result);
  }

  if (kind === "anthropic") {
    const blocks = Array.isArray(payload.content) ? payload.content : [];
    result.reasoning = blocks
      .filter((block) => block && block.type === "thinking")
      .map((block) => safeText(block.thinking))
      .filter(Boolean)
      .join("\n\n");
    result.content = blocks
      .filter((block) => block && block.type === "text")
      .map((block) => safeText(block.text))
      .filter(Boolean)
      .join("\n\n");
    result.images = extractAnthropicImages(blocks);
    result.files = extractProviderOutputFiles(payload, "anthropic");
    return applyThinkTagCompatibility(result);
  }

  if (kind === "responses") {
    const output = Array.isArray(payload.output) ? payload.output : [];
    result.reasoning = output
      .filter((item) => item && item.type === "reasoning")
      .flatMap((item) => (Array.isArray(item.summary) ? item.summary : []))
      .filter((item) => item && (item.type === "summary_text" || typeof item.text === "string"))
      .map((item) => safeText(item.text))
      .filter(Boolean)
      .join("\n\n");
    result.content = output
      .filter((item) => item && item.type === "message")
      .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
      .filter((item) => item && (item.type === "output_text" || item.type === "text"))
      .map((item) => safeText(item.text))
      .filter(Boolean)
      .join("\n\n");
    if (!result.content && typeof payload.output_text === "string") {
      result.content = payload.output_text;
    }
    result.images = extractResponsesImages(output);
    result.files = extractProviderOutputFiles(payload, "responses");
    return applyThinkTagCompatibility(result);
  }

  if (kind === "google") {
    const candidate = payload.candidates && payload.candidates[0];
    const content = candidate && candidate.content;
    const parts = content && Array.isArray(content.parts) ? content.parts : [];
    result.usage = normalizeUsageObject(payload.usageMetadata);
    result.reasoning = parts
      .filter((part) => part && part.thought === true && typeof part.text === "string")
      .map((part) => safeText(part.text))
      .filter(Boolean)
      .join("\n\n");
    result.content = parts
      .filter((part) => part && part.thought !== true && typeof part.text === "string")
      .map((part) => safeText(part.text))
      .filter(Boolean)
      .join("\n\n");
    result.images = extractProviderOutputImages(payload, "google");
    result.files = extractProviderOutputFiles(payload, "google");
    return applyThinkTagCompatibility(result);
  }

  const message = (payload.choices && payload.choices[0] && payload.choices[0].message) || payload.message || payload;
  result.reasoning = safeText(
    message.reasoning_content || message.reasoning || payload.reasoning_content || ""
  );
  result.content = normalizeTextContent(
    message.content ?? payload.content ?? payload.output_text ?? ""
  );
  result.images = extractCompatibleImages(message);
  result.files = extractProviderOutputFiles(payload, "openai-compatible");
  return applyThinkTagCompatibility(result);
}
