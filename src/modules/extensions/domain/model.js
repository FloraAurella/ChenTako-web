"use strict";

/**
 * Tools / Skills 的本地配置契约。
 *
 * 这里刻意只保存可以安全写入 Chat 归档的声明性数据：没有 API Key、
 * Authorization header 或其它秘密。真正调用时由后端再次做 URL、大小与
 * 结构校验；前端负责让设置页、全局启用状态和持久化保持同一数据模型。
 */

const TOOL_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const LOOPBACK_HOST_PATTERN = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|::1)$/i;
const MAX_TOOLS = 16;
const MAX_SKILLS = 16;
const MAX_SCHEMA_CHARS = 24 * 1024;
const MAX_SKILL_INSTRUCTIONS = 16 * 1024;

function createExtensionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ext-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanString(value, max) {
  return String(value ?? "").slice(0, max).trim();
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function utf8ByteLength(value) {
  const text = String(value ?? "");
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
  // 旧 WebView 的兼容兜底；现代浏览器与 Electron 都会走 TextEncoder 分支。
  return unescape(encodeURIComponent(text)).length;
}

function normalizeUrl(value) {
  const raw = cleanString(value, 4096);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}

/** 初始阶段只支持 HTTPS 或回环 HTTP；其余 HTTP 会被后端的 SSRF 策略拒绝。 */
export function isSupportedExtensionUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;
  const parsed = new URL(normalized);
  if (parsed.protocol === "https:") return true;
  return parsed.protocol === "http:" && LOOPBACK_HOST_PATTERN.test(parsed.hostname);
}

function normalizeInputSchema(value) {
  const cloned = cloneJson(value);
  if (!isRecord(cloned) || cloned.type !== "object") {
    return { type: "object", properties: {} };
  }
  const text = JSON.stringify(cloned);
  if (utf8ByteLength(text) > MAX_SCHEMA_CHARS) return { type: "object", properties: {} };
  return cloned;
}

function normalizeTool(raw) {
  const source = isRecord(raw) ? raw : {};
  return {
    id: cleanString(source.id, 100) || createExtensionId(),
    name: cleanString(source.name, 64),
    description: cleanString(source.description, 600),
    endpoint: normalizeUrl(source.endpoint),
    inputSchema: normalizeInputSchema(source.inputSchema),
    enabled: source.enabled === true
  };
}

function normalizeSkill(raw) {
  const source = isRecord(raw) ? raw : {};
  return {
    id: cleanString(source.id, 100) || createExtensionId(),
    name: cleanString(source.name, 80) || "未命名 Skill",
    description: cleanString(source.description, 600),
    instructions: cleanString(source.instructions, MAX_SKILL_INSTRUCTIONS),
    enabled: source.enabled === true
  };
}

function normalizeSandbox(raw) {
  const source = isRecord(raw) ? raw : {};
  return { enabled: source.enabled === true };
}

function normalizeCodeInterpreter(raw) {
  const source = isRecord(raw) ? raw : {};
  return { enabled: source.enabled === true };
}

function uniqueById(entries, limit) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry.id || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).slice(0, limit);
}

/** 归档中可持久化的完整扩展注册表。 */
export function normalizeExtensions(raw) {
  const source = isRecord(raw) ? raw : {};
  return {
    version: 1,
    tools: uniqueById((Array.isArray(source.tools) ? source.tools : []).map(normalizeTool), MAX_TOOLS),
    skills: uniqueById((Array.isArray(source.skills) ? source.skills : []).map(normalizeSkill), MAX_SKILLS),
    sandbox: normalizeSandbox(source.sandbox),
    codeInterpreter: normalizeCodeInterpreter(source.codeInterpreter)
  };
}

/** 旧归档兼容：保留历史会话选择的数据形状；运行时不再读取它。 */
export function normalizeExtensionSelection(raw) {
  const source = isRecord(raw) ? raw : {};
  const normalizeIds = (value, limit) => [...new Set(
    (Array.isArray(value) ? value : [])
      .map((id) => cleanString(id, 100))
      .filter(Boolean)
  )].slice(0, limit);
  const selection = {
    tools: normalizeIds(source.tools, MAX_TOOLS),
    skills: normalizeIds(source.skills, MAX_SKILLS),
    sandbox: source.sandbox === true
  };
  // 保留旧归档中该属性的“存在/缺失”语义，不为更早版本凭空补字段。
  if (Object.prototype.hasOwnProperty.call(source, "codeInterpreter")) {
    selection.codeInterpreter = source.codeInterpreter === true;
  }
  return selection;
}

/**
 * 返回设置中全局启用的安全声明，供每一次 Chat 请求使用。
 *
 * `extensionSelection` 仍可从旧归档读取，但从 v0.2.0 patch 起不再参与运行时
 * 授权；设置页开关是唯一生效来源。
 */
export function enabledExtensions(registry) {
  const normalized = normalizeExtensions(registry);
  return {
    tools: normalized.tools.filter((item) => item.enabled),
    skills: normalized.skills.filter((item) => item.enabled),
    sandbox: normalized.sandbox.enabled,
    codeInterpreter: normalized.codeInterpreter.enabled
  };
}

export function createExtensionDraft(kind) {
  if (kind === "tool") {
    return {
      id: createExtensionId(),
      name: "",
      description: "",
      endpoint: "",
      inputSchema: { type: "object", properties: {}, required: [] },
      enabled: true
    };
  }
  return {
    id: createExtensionId(),
    name: "",
    description: "",
    instructions: "",
    enabled: true
  };
}

/** 设置表单的可读错误；保存前调用，避免无效配置进入请求链路。 */
export function validateExtensionDraft(kind, raw, registry = null) {
  const source = isRecord(raw) ? raw : {};
  if (kind === "tool") {
    const name = cleanString(source.name, 64);
    if (!TOOL_NAME_PATTERN.test(name)) {
      return "工具名称需以英文字符开头，只能包含字母、数字、_ 或 -，且不超过 64 个字符";
    }
    if (!cleanString(source.description, 600)) return "请说明工具要完成什么";
    if (!isSupportedExtensionUrl(source.endpoint)) return "工具地址仅支持 HTTPS 或本机回环 HTTP 地址";
    const schema = cloneJson(source.inputSchema);
    if (!isRecord(schema) || schema.type !== "object") {
      return "输入 Schema 的根节点必须是 type 为 object 的 JSON 对象";
    }
    if (utf8ByteLength(JSON.stringify(schema)) > MAX_SCHEMA_CHARS) return "输入 Schema 不能超过 24KB";
    const sameName = (registry?.tools || []).find((tool) => tool.name === name && tool.id !== source.id);
    if (sameName) return `工具名称「${name}」已被使用`;
    return "";
  }
  if (!cleanString(source.name, 80)) return "请填写 Skill 名称";
  if (!cleanString(source.description, 600)) return "请简述这个 Skill 适用的任务";
  if (!String(source.instructions ?? "").trim()) return "请填写给模型的 Skill 指令";
  if (utf8ByteLength(String(source.instructions)) > MAX_SKILL_INSTRUCTIONS) {
    return "Skill 指令不能超过 16KB";
  }
  return "";
}

export const EXTENSION_LIMITS = Object.freeze({
  tools: MAX_TOOLS,
  skills: MAX_SKILLS,
  schemaChars: MAX_SCHEMA_CHARS,
  skillInstructions: MAX_SKILL_INSTRUCTIONS
});
