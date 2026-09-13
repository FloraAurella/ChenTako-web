import { promptText } from "../../../resources/public/prompts.js";
import { EFFORT_LEVELS } from "../../../contracts/constants.js";

export const SETTINGS_SCHEMA_VERSION = 2;
export const CHAT_CONFIG_DEFAULTS = Object.freeze({
  systemPrompt: "", compressionThreshold: 80, compressionModel: null, titleModel: null,
  defaultReasoningEffort: "medium", temperature: 0.7, topP: 1,
  streaming: true, saveChats: true, userId: ""
});
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const efforts = EFFORT_LEVELS.map((level) => level.key);
const labels = { compressionThreshold: "压缩触发阈值", temperature: "Temperature", topP: "Top P", systemPrompt: "系统提示词", userId: "User ID", streaming: "流式输出", saveChats: "本地保存对话" };
const ranges = { compressionThreshold: [10, 95, true], temperature: [0, 2], topP: [0, 1] };
export function validateChatConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "配置必须是对象";
  for (const key of Object.keys(CHAT_CONFIG_DEFAULTS)) {
    if (!own(value, key)) continue;
    const v = value[key];
    if (["compressionModel", "titleModel"].includes(key)) {
      if (v === null) continue;
      if (!v || typeof v !== "object" || Array.isArray(v) || typeof v.providerId !== "string" || !v.providerId.trim() || v.providerId.length > 200 || typeof v.model !== "string" || !v.model.trim() || v.model.length > 200) return "请选择有效的供应商与模型";
      continue;
    }
    if (ranges[key]) {
      const [min, max, integer] = ranges[key];
      if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) return `${labels[key]} 必须在 ${min}–${max} 之间${integer ? "，且为整数" : ""}`;
    } else if (["streaming", "saveChats"].includes(key)) {
      if (typeof v !== "boolean") return `${labels[key]} 必须是开关值`;
    } else if (key === "defaultReasoningEffort") {
      if (!efforts.includes(v)) return "请选择有效的思考强度";
    } else if (typeof v !== "string" || v.length > (key === "systemPrompt" ? 102400 : 200)) return `${labels[key]} 文本过长或格式无效`;
  }
  return "";
}
export function normalizeChatConfig(value, partial = false) {
  const result = partial ? {} : { ...CHAT_CONFIG_DEFAULTS };
  for (const key of Object.keys(CHAT_CONFIG_DEFAULTS)) {
    if (own(value, key) && !validateChatConfig({ [key]: value[key] })) result[key] = value[key] && typeof value[key] === "object" ? { providerId: value[key].providerId, model: value[key].model } : value[key];
  }
  return result;
}
export function resolveChatConfig(state, conversation = {}) {
  const base = normalizeChatConfig(state.chatConfig);
  const project = state.projects?.find((entry) => entry.id === conversation.projectId);
  const overrides = normalizeChatConfig(project?.configOverrides, true);
  const config = { ...base, ...overrides };
  return { ...config, systemPrompt: promptText("system"), reasoningEffort: efforts.includes(conversation.reasoningEffortOverride) ? conversation.reasoningEffortOverride : config.defaultReasoningEffort };
}
export function normalizeCompatibility(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([, models]) => models && typeof models === "object").map(([id, models]) => [id,
    Object.fromEntries(Object.entries(models).filter(([, caps]) => caps && typeof caps === "object").map(([model, caps]) => [model, Object.fromEntries(["visionInput", "imageOutput"].map((key) => [key, typeof caps[key] === "boolean" ? caps[key] : "auto"]))]))
  ]));
}
export function modelCompatibility(state, providerId, model) {
  return state.modelCompatibility?.[providerId]?.[model] || { visionInput: "auto", imageOutput: "auto" };
}

function legacyFields(value, keys) {
  return Object.fromEntries(keys.filter((key) => own(value, key) && ["string", "boolean", "number"].includes(typeof value[key])).map((key) => [key, value[key]]));
}

/** Whitelist only behavior fields; credentials and connection metadata never enter the backup. */
export function legacySettingsBackup(source) {
  const records = (value) => Array.isArray(value) ? value.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)) : [];
  const providers = records(source?.providers);
  const conversations = records(source?.conversations);
  const keys = ["systemPrompt", "temperature", "topP", "defaultReasoningEffort", "streaming", "saveChats", "userId"];
  return {
    providers: providers.map((p) => ({ id: String(p.id || ""), displayName: String(p.displayName || ""),
      ...legacyFields(p, keys),
      modelCapabilities: normalizeCompatibility({ p: p.modelCapabilities }).p || {},
      modelOverrides: Object.fromEntries(Object.entries(p.modelOverrides || {}).map(([model, entry]) => [model, legacyFields(entry, keys)]))
    })),
    conversations: conversations.map((c) => ({ id: String(c.id || ""), reasoningEffort: String(c.reasoningEffort || ""), saveChats: c.saveChats !== false && providers.find((p) => p.id === c.providerId)?.saveChats !== false }))
  };
}
function normalizeLegacyContextPolicy(source) {
  const policy = source.legacySettingsBackup?.contextPolicy;
  const projects = policy?.projects ?? source.projects;
  return {
    defaults: legacyFields(policy?.defaults ?? source.chatConfig, ["inputBudget", "autoCompress"]),
    projects: (Array.isArray(projects) ? projects : []).filter(p => p && typeof p === "object").map(p => ({
      id: String(p.id || ""), ...legacyFields(policy ? p : p.configOverrides, ["inputBudget", "autoCompress"])
    }))
  };
}
export function migrateChatSettings(source) {
  if (source.settingsSchemaVersion >= 1) return {
    settingsSchemaVersion: SETTINGS_SCHEMA_VERSION, chatConfig: normalizeChatConfig(source.chatConfig),
    modelCompatibility: normalizeCompatibility(source.modelCompatibility),
    legacySettingsBackup: { ...(source.legacySettingsBackup ? legacySettingsBackup(source.legacySettingsBackup) : {}),
      contextPolicy: normalizeLegacyContextPolicy(source) },
    settingsMigrationApplied: false
  };
  return { settingsSchemaVersion: SETTINGS_SCHEMA_VERSION, chatConfig: { ...CHAT_CONFIG_DEFAULTS }, modelCompatibility: {},
    legacySettingsBackup: legacySettingsBackup(source), settingsMigrationApplied: true };
}
