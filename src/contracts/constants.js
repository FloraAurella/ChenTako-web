"use strict";

/** ChenTako core 层常量：存储键、限额、思考强度、供应商预设。 */

export const APP_NAME = "ChenTako";
export const APP_VERSION = "1.1.5";
export const APP_SETTINGS_VERSION = APP_VERSION;

// 持久化键是已发布的数据协议，不随产品品牌改名。继续使用旧命名空间可让
// ChenTako 原地读取升级前的对话、草稿、主题与界面偏好。
export const STORAGE_KEYS = {
  state: "tribblebook-v6-state",
  drafts: "tribblebook-drafts-v1", // 草稿轻量存储：击键只写这里，不触发全量状态序列化
  appMode: "tribblebook-app-mode",
  uiPreferences: "tribblebook-ui-preferences-v1",
  userThemes: "tribblebook-user-themes-v1",
  themeArchive: "tribblebook-theme-bundle-v1",
  themeAppearance: "clawbox-theme-appearance-v1",
  themeBackgrounds: "tribblebook-theme-backgrounds-v1", // 背景回落存储 + 迁移源（主存 IndexedDB）
  background: "tribblebook-background-v1" // 旧版全局背景，仅作迁移读取源
};

export const STATE_DB = {
  name: "tribblebook-state-v1",
  store: "state",
  key: "current"
};

/** 主题背景主存：IndexedDB，每个主题一条记录（key = 主题 ID）。 */
export const THEME_BACKGROUND_DB = {
  name: "tribblebook-backgrounds-v1",
  store: "themes"
};

/** 桌面版主题定义包：位于当前 Electron userData（.clawbox/UserData）根目录。 */
export const THEME_ARCHIVE_FILENAME = "themes.clawbox";

// ---- 限额（与后端 backend/src/routes/chat.ts 保持一致） ----

export const LIMITS = {
  attachmentBytes: 5 * 1024 * 1024,
  attachmentsTotalBytes: 15 * 1024 * 1024,
  imageBytes: 20 * 1024 * 1024,
  imagesPerMessage: 4,
  imagesTotalBytes: 80 * 1024 * 1024,
  fileBytes: 20 * 1024 * 1024,
  filesPerMessage: 8,
  filesTotalBytes: 80 * 1024 * 1024,
  messageChars: 100 * 1024,
  requestSystemPromptChars: 16 * 1024 * 1024,
  draftChars: 100 * 1024,
  summaryChars: 2 * 1024 * 1024,
  importBytes: 130 * 1024 * 1024,
  backgroundImageBytes: 20 * 1024 * 1024,
  themeFileBytes: 256 * 1024,
  themePackageBytes: 5 * 1024 * 1024,
  persistDebounceMs: 320,
  estimateCharsPerToken: 3.6,
  defaultContextWindow: 131072,
  titleLength: 18
};

export const TEXT_FILE_EXTENSIONS = [
  "txt", "md", "markdown", "json", "csv", "tsv", "xml", "html", "htm",
  "css", "js", "mjs", "cjs", "jsx", "ts", "tsx", "py", "java", "go",
  "rs", "c", "cpp", "h", "hpp", "sql", "yml", "yaml", "toml", "log", "sh", "swift", "kt"
];

export const TEXT_FILE_MIME_PREFIXES = ["text/", "application/json", "application/xml", "application/x-yaml", "application/toml"];

export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** 浏览器 File.type 为空时的扩展名 → mime 推断（与后端 code-interpreter/sandbox 的映射保持一致）。 */
export const FILE_MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  xml: "application/xml",
  yaml: "application/x-yaml",
  yml: "application/x-yaml",
  txt: "text/plain",
  md: "text/markdown",
  html: "text/html",
  htm: "text/html",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  svg: "image/svg+xml"
};

export const RESPONSE_FORMATS = [
  { key: "responses", label: "OpenAI Responses" },
  { key: "anthropic", label: "Anthropic Messages" },
  { key: "openai-compatible", label: "OpenAI Chat Completions" },
  { key: "google", label: "Google Gemini" }
];

/** 五档思考强度（UI 顺序 low → max；后端负责映射到各协议推理参数）。
 *  axis 是滑轨上的英文轴标签；shortLabel 是常驻摘要与当前值的实时双语短标签。
 *  状态值本身保持 low/medium/high/xhigh/max，不新增档位。 */
export const EFFORT_LEVELS = [
  {
    key: "low",
    axis: "Low",
    label: "轻量",
    shortLabel: "Low-轻量",
    description: "快速斟酌，适合简单问答与日常改写。"
  },
  {
    key: "medium",
    axis: "Medium",
    label: "中等",
    shortLabel: "Medium-中等",
    description: "均衡的思考预算，适合多数日常任务。"
  },
  {
    key: "high",
    axis: "High",
    label: "高",
    shortLabel: "High-高",
    description: "更深的推理链，适合分析、规划与代码。"
  },
  {
    key: "xhigh",
    axis: "XHigh",
    label: "极高",
    shortLabel: "XHigh-极高",
    description: "接近模型思考上限，用于复杂推理难题。"
  },
  {
    key: "max",
    axis: "Max",
    label: "最大",
    shortLabel: "Max-最大",
    description: "推满推理预算，耗时最长，慎用于急件。"
  }
];

export const DEFAULT_EFFORT = "medium";

/** 历史会话可能残留已移除的 none 档：显示时回落到最低档，状态值不迁移。 */
export function effortLevelOf(key) {
  if (key === "none") return EFFORT_LEVELS[0];
  return EFFORT_LEVELS.find((level) => level.key === key) ||
    EFFORT_LEVELS.find((level) => level.key === DEFAULT_EFFORT);
}

/** 首版不暴露内置测试供应商；真实供应商从下方四种协议模板创建。 */
export const PROVIDER_PRESETS = [];

export const EXPORT_ARCHIVE_KIND = "ai-chatbox-conversation";
export const EXPORT_ARCHIVE_VERSION = 3;
