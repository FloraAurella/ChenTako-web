"use strict";

/**
 * 用户 JSON 主题（设置 → 外观 → 自定义 上传）：
 * 解析 #RRGGBB 十六进制色板 → 主题定义，经契约校验后注册；
 * 原始 JSON 可暂存于旧 localStorage（clawbox-user-themes-v1），启动时由主题包控制器迁移；
 * 该模块仍保留读写函数以兼容旧版本与浏览器回退。
 * 文件格式与各模块对应的界面区域见项目根目录 CUSTOM_THEME_GUIDE.md。
 */

import { isValidThemeId, validateThemeDefinition } from "./contract.js";
import { LIGHT_TOKENS, DARK_TOKENS } from "./base-themes.js";
import { registerTheme } from "./registry.js";
import { createSafeStorage } from "../../../shared/storage/safe-storage.js";
import { STORAGE_KEYS } from "../../../contracts/constants.js";
import {
  FONT_ROLES,
  FONT_STACKS,
  normalizeTypefaces,
  isValidTypefaceRole,
  isValidTypefaceStack,
  applyTypefacesToTokens
} from "../../../resources/fonts/stacks.js";

export const USER_THEME_FORMAT = "ai-chatbox-theme";
const LEGACY_USER_THEME_FORMAT = "tribblebook-theme";
export const USER_THEME_FILE_VERSION = 1;
export const USER_THEME_FILE_VERSION_V2 = 2;
export const MAX_USER_THEMES = 12;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * colors.<module>.<key> → CSS 令牌映射。
 * alpha 字段表示该令牌按 rgba(r, g, b, alpha) 应用（数组 = [浅色, 深色] 两套透明度），
 * 文件里仍只需写 #RRGGBB，透明度由系统按内置基线补齐。
 */
const COLOR_MODULES = {
  canvas: {
    top: { token: "--canvas-start" },
    middle: { token: "--canvas-mid" },
    bottom: { token: "--canvas-end" }
  },
  surface: {
    content: { token: "--surface-content" },
    elevated: { token: "--surface-elevated" },
    subtle: { token: "--paper-subtle" },
    raised: { token: "--paper-raised" }
  },
  text: {
    primary: { token: "--label" },
    secondary: { token: "--label-secondary" },
    tertiary: { token: "--label-tertiary" }
  },
  identity: {
    pear: { token: "--pear" },
    pearHover: { token: "--pear-hover" },
    onPear: { token: "--on-pear" },
    logo: { token: "--brand-logo" },
    onLogo: { token: "--on-brand-logo" }
  },
  assistant: {
    background: { token: "--assistant-bubble-bg", alpha: [0.72, 0.66] },
    border: { token: "--assistant-bubble-border", alpha: [0.32, 0.28] }
  },
  user: {
    background: { token: "--user-bubble-bg", alpha: [0.72, 0.66] },
    border: { token: "--user-bubble-border", alpha: [0.32, 0.28] },
    text: { token: "--on-user-bubble" }
  },
  action: {
    base: { token: "--accent" },
    hover: { token: "--accent-hover" },
    pressed: { token: "--accent-pressed" },
    soft: { token: "--accent-soft" },
    onAccent: { token: "--on-accent" },
    focusRing: { token: "--focus-ring" }
  },
  buttons: {
    primary: { token: "--btn-primary" },
    primaryHover: { token: "--btn-primary-hover" },
    primaryPressed: { token: "--btn-primary-pressed" },
    onPrimary: { token: "--on-btn-primary" },
    send: { token: "--send-btn" },
    sendHover: { token: "--send-btn-hover" },
    sendPressed: { token: "--send-btn-pressed" },
    onSend: { token: "--on-send-btn" },
    icon: { token: "--icon-btn-ink" },
    iconHover: { token: "--icon-btn-ink-hover" },
    iconHoverBg: { token: "--icon-btn-hover-bg" }
  },
  context: {
    base: { token: "--context" },
    soft: { token: "--context-soft" },
    selectedFill: { token: "--fill-selected" }
  },
  separator: {
    regular: { token: "--separator", alpha: [0.14, 0.12] },
    strong: { token: "--separator-strong", alpha: [0.24, 0.2] }
  },
  status: {
    destructive: { token: "--destructive" },
    warning: { token: "--warning" },
    success: { token: "--success" }
  },
  shadow: {
    regular: { token: "--shadow-ink", alpha: [0.16, 0.42] },
    strong: { token: "--shadow-ink-strong", alpha: [0.3, 0.58] }
  },
  glass: {
    regular: { token: "--glass-bg", alpha: [0.74, 0.72] },
    strong: { token: "--glass-strong-bg", alpha: [0.94, 0.92] }
  },
  ambient: {
    glow: { token: "--ambient-glow", alpha: [0.05, 0.05] },
    vignette: { token: "--vignette", alpha: [0.05, 0.12] }
  },
  effects: {
    highlight: { token: "--control-highlight" },
    highlightStrong: { token: "--control-highlight-strong" },
    shadow: { token: "--control-shadow" },
    overlay: { token: "--overlay-scrim" },
    overlayText: { token: "--overlay-text" },
    overlayControl: { token: "--overlay-control" },
    overlayShadow: { token: "--overlay-shadow" },
    imageFill: { token: "--image-fill" }
  },
  groups: {
    one: { token: "--group-color-1" },
    two: { token: "--group-color-2" },
    three: { token: "--group-color-3" },
    four: { token: "--group-color-4" },
    five: { token: "--group-color-5" }
  },
  code: {
    background: { token: "--code-bg" },
    border: { token: "--code-border" },
    inlineBackground: { token: "--code-inline-bg" },
    inlineText: { token: "--code-inline-text" }
  },
  syntax: {
    plain: { token: "--syntax-plain" },
    comment: { token: "--syntax-comment" },
    keyword: { token: "--syntax-keyword" },
    string: { token: "--syntax-string" },
    constant: { token: "--syntax-constant" },
    entity: { token: "--syntax-entity" },
    variable: { token: "--syntax-variable" },
    list: { token: "--syntax-list" },
    quote: { token: "--syntax-quote" },
    invalid: { token: "--syntax-invalid" }
  },
  effort: {
    panel: { token: "--effort-panel" },
    ink: { token: "--effort-panel-ink" },
    track: { token: "--effort-track" },
    accent: { token: "--effort-accent" },
    accent2: { token: "--effort-accent-2" },
    maxAccent: { token: "--effort-max-accent" },
    maxStart: { token: "--effort-max-start" },
    accentSoft: { token: "--effort-accent-soft" },
    thumb: { token: "--effort-thumb" },
    dot: { token: "--effort-dot" }
  }
};

export const USER_THEME_COLOR_MODULES = COLOR_MODULES;
export const USER_THEME_MODULE_NAMES = Object.keys(COLOR_MODULES);

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function alphaColor(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hashString(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * name → 合法主题 ID；拉丁名走 slug，非拉丁名用稳定哈希兜底。
 * 主题文件的稳定 ID 在首次生成（导入 / 导出主题包）时确定，之后不再更改：
 * 同名派生结果恒定，因此同主题再次上传命中同一 ID 即为更新；带 ID 的文件直接沿用。
 */
export function deriveThemeId(name) {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (isValidThemeId(slug)) return slug;
  return `user-${hashString(String(name || "theme"))}`;
}

function readHex(rawColors, moduleName, key) {
  const value = rawColors && rawColors[moduleName] && rawColors[moduleName][key];
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value) ? value.toLowerCase() : "";
}

/**
 * 将 colors 对象解析为 tokens（供一个明暗档位使用）。
 * @param {object} colors - 模块分组的颜色对象
 * @param {object} lightTokens - 明色令牌表（v1 单态会同时填充）
 * @param {object} darkTokens - 暗色令牌表（v1 单态会同时填充）
 * @param {string[]} errors - 错误收集器
 * @param {string} schemeName - 档位名称（用于错误提示）
 * @param {boolean} isDualMode - 是否为 v2 双态模式
 * @returns {number} 解析到的颜色数量
 */
function parseColorsIntoTokens(colors, lightTokens, darkTokens, errors, schemeName, isDualMode) {
  let colorCount = 0;
  for (const [moduleName, entries] of Object.entries(colors)) {
    const spec = COLOR_MODULES[moduleName];
    if (!spec) {
      errors.push(`未知模块：colors.${moduleName}（可选模块：${USER_THEME_MODULE_NAMES.join(" / ")}）`);
      continue;
    }
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
      errors.push(`colors.${moduleName} 必须是对象`);
      continue;
    }
    for (const [key, value] of Object.entries(entries)) {
      const field = spec[key];
      if (!field) {
        errors.push(`colors.${moduleName} 不支持字段：${key}`);
        continue;
      }
      if (typeof value !== "string" || !HEX_COLOR_PATTERN.test(value)) {
        errors.push(`colors.${moduleName}.${key} 必须是 #RRGGBB 六位十六进制颜色（当前值：${String(value)}）`);
        continue;
      }
      const hex = value.toLowerCase();
      colorCount += 1;
      
      if (isDualMode) {
        // v2 双态：只填充当前档位的令牌
        const targetTokens = schemeName === "dark" ? darkTokens : lightTokens;
        if (field.alpha) {
          targetTokens[field.token] = alphaColor(hex, field.alpha[schemeName === "dark" ? 1 : 0]);
        } else {
          targetTokens[field.token] = hex;
        }
      } else {
        // v1 单态：同时填充明暗令牌（带 alpha 的分别取明暗透明度）
        if (field.alpha) {
          lightTokens[field.token] = alphaColor(hex, field.alpha[0]);
          darkTokens[field.token] = alphaColor(hex, field.alpha[1]);
        } else {
          lightTokens[field.token] = hex;
          darkTokens[field.token] = hex;
        }
      }
    }
  }
  return colorCount;
}

/**
 * 解析并转换 JSON 主题文件。
 * 返回 { errors, raw, definition }：errors 为空数组时 definition 可直接注册。
 */
export function buildUserThemeDefinition(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { errors: ["主题文件必须是 JSON 对象"], raw: null, definition: null };
  }
  const errors = [];
  if (![USER_THEME_FORMAT, "clawbox-theme", LEGACY_USER_THEME_FORMAT].includes(raw.format)) {
    errors.push(`format 必须是 "${USER_THEME_FORMAT}"`);
  }
  const version = raw.version === USER_THEME_FILE_VERSION_V2 ? 2 : raw.version === USER_THEME_FILE_VERSION ? 1 : 0;
  if (version === 0) {
    errors.push(`version 必须是 ${USER_THEME_FILE_VERSION} 或 ${USER_THEME_FILE_VERSION_V2}`);
  }

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) errors.push("name（主题名字）必填");
  else if (name.length > 40) errors.push("name（主题名字）不能超过 40 字符");
  if (raw.description !== undefined &&
      (typeof raw.description !== "string" || raw.description.length > 120)) {
    errors.push("description（主题简介）不能超过 120 字符");
  }

  const scheme = raw.scheme === "dark" ? "dark" : raw.scheme === "light" ? "light" : "";
  if (raw.scheme !== undefined && !scheme) {
    errors.push('scheme（固定明暗）只能是 "light" 或 "dark"');
  }

  let id = "";
  if (raw.id !== undefined) {
    if (typeof raw.id !== "string" || !isValidThemeId(raw.id)) {
      errors.push("id 必须以小写字母开头，仅含小写字母/数字/连字符，最长 48 位");
    } else {
      // 内置主题 ID（juicy-pear / night-orchard）允许使用：携带同 ID 的文件 = 更新内置主题，
      // 与"主题包唯一真源、同 ID 更新"的语义一致。
      id = raw.id;
    }
  } else if (name) {
    id = deriveThemeId(name);
  }

  const lightTokens = {};
  const darkTokens = {};
  const colors = raw.colors;
  if (colors === undefined) {
    errors.push("colors（各模块颜色）必填");
  } else if (!colors || typeof colors !== "object" || Array.isArray(colors)) {
    errors.push("colors 必须是按模块分组的对象");
  } else {
    // v2 格式：colors: { light: {...}, dark: {...} }（双态）
    // v1 格式：colors: { action: {...}, ... }（单态，需配合 scheme）
    const isDualMode = colors.light !== undefined || colors.dark !== undefined;
    
    if (version === 2) {
      // v2 必须是双态格式
      if (!isDualMode) {
        errors.push("version: 2 需要使用双态格式 colors: { light: {...}, dark: {...} }");
      }
      if (raw.scheme !== undefined) {
        errors.push("v2 双态主题不应包含 scheme 字段（由用户切换明暗模式控制）");
      }
      
      const lightColors = colors.light && typeof colors.light === "object" ? colors.light : null;
      const darkColors = colors.dark && typeof colors.dark === "object" ? colors.dark : null;
      
      if (!lightColors && !darkColors) {
        errors.push("v2 格式的 colors.light 和 colors.dark 至少需要提供一个");
      }
      
      let totalColors = 0;
      if (lightColors) {
        totalColors += parseColorsIntoTokens(lightColors, lightTokens, darkTokens, errors, "light", true);
      }
      if (darkColors) {
        totalColors += parseColorsIntoTokens(darkColors, lightTokens, darkTokens, errors, "dark", true);
      }
      
      if (totalColors === 0) {
        errors.push("colors 至少要提供一个颜色");
      }
      
      // 补全缺失档位：回落到基线令牌（保留用户已定义的令牌）
      if (lightColors && !darkColors) {
        Object.keys(DARK_TOKENS).forEach(key => {
          if (darkTokens[key] === undefined) darkTokens[key] = DARK_TOKENS[key];
        });
      } else if (darkColors && !lightColors) {
        Object.keys(LIGHT_TOKENS).forEach(key => {
          if (lightTokens[key] === undefined) lightTokens[key] = LIGHT_TOKENS[key];
        });
      }
    } else if (version === 1) {
      // v1 单态格式
      if (isDualMode) {
        errors.push("colors.light / colors.dark 双态定义需要 version: 2");
      }
      
      const targetTokens = scheme === "dark" ? darkTokens : lightTokens;
      const colorCount = parseColorsIntoTokens(colors, lightTokens, darkTokens, errors, scheme || "light", false);
      
      if (colorCount === 0) {
        errors.push("colors 至少要提供一个颜色");
      }
      
      // v1 单态主题：parseColorsIntoTokens 已同时填充明暗令牌，无需额外补全
    }
  }

  if (raw.iridescence !== undefined) {
    const iridescence = raw.iridescence;
    if (!iridescence || typeof iridescence !== "object" || Array.isArray(iridescence)) {
      errors.push("iridescence 必须是 { colors, idleOpacity, activeOpacity } 对象");
    } else {
      const list = iridescence.colors;
      if (!Array.isArray(list) || list.length < 2 || list.length > 12) {
        errors.push("iridescence.colors 需要 2–12 个 #RRGGBB 颜色");
      } else {
        const hexes = [];
        for (const value of list) {
          if (typeof value !== "string" || !HEX_COLOR_PATTERN.test(value)) {
            errors.push(`iridescence.colors 的每一项必须是 #RRGGBB 六位十六进制颜色（当前值：${String(value)}）`);
            hexes.length = 0;
            break;
          }
          hexes.push(value.toLowerCase());
        }
        if (hexes.length) {
          const gradient = `conic-gradient(from 210deg, ${[...hexes, hexes[0]].join(", ")})`;
          lightTokens["--rainbow"] = gradient;
          darkTokens["--rainbow"] = gradient;
        }
      }
      const opacities = [["idleOpacity", 0.18], ["activeOpacity", 0.36]];
      for (const [key, fallback] of opacities) {
        const value = iridescence[key];
        if (value === undefined) continue;
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
          errors.push(`iridescence.${key} 必须是 0–1 之间的数字`);
          continue;
        }
        const token = key === "idleOpacity" ? "--rainbow-alpha" : "--rainbow-alpha-active";
        lightTokens[token] = String(value);
        darkTokens[token] = String(value);
      }
    }
  }

  if (raw.typefaces !== undefined) {
    const typefaces = raw.typefaces;
    if (!typefaces || typeof typefaces !== "object" || Array.isArray(typefaces)) {
      errors.push("typefaces 必须是 { body, display, mono } 对象");
    } else {
      for (const [role, value] of Object.entries(typefaces)) {
        if (!isValidTypefaceRole(role)) {
          errors.push(`不支持的字体角色：${role}（可用：${FONT_ROLES.join(" / ")}）`);
        } else if (!isValidTypefaceStack(value)) {
          errors.push(`无效的字体栈：${String(value)}（可用：${Object.keys(FONT_STACKS).join(" / ")}）`);
        }
      }
    }
  }

  if (errors.length) return { errors, raw, definition: null };

  // 可选字体：typefaces 从内置字体栈白名单选择（body / display / mono），
  // 缺省/未提供时补默认栈，并把选中的栈写入明暗两档令牌（mono 同时覆盖代码字体）。
  const typefaces = normalizeTypefaces(raw.typefaces);
  const fontTokens = applyTypefacesToTokens(typefaces, {});
  lightTokens["--font-body"] = fontTokens["--font-body"];
  lightTokens["--font-display"] = fontTokens["--font-display"];
  lightTokens["--font-mono"] = fontTokens["--font-mono"];
  lightTokens["--font-code"] = fontTokens["--font-code"];
  darkTokens["--font-body"] = fontTokens["--font-body"];
  darkTokens["--font-display"] = fontTokens["--font-display"];
  darkTokens["--font-mono"] = fontTokens["--font-mono"];
  darkTokens["--font-code"] = fontTokens["--font-code"];

  // v2 双态主题：preview 需从 colors.light 或 colors.dark 中提取（优先 light）
  const previewColors = (raw.colors && raw.colors.light) || raw.colors;
  
  const definition = {
    id,
    label: name,
    note: typeof raw.description === "string" ? raw.description.trim() : "",
    preview: {
      canvas: readHex(previewColors, "canvas", "middle") || LIGHT_TOKENS["--canvas-mid"],
      paper: readHex(previewColors, "surface", "raised") || readHex(previewColors, "surface", "content") || LIGHT_TOKENS["--surface-content"],
      accent: readHex(previewColors, "action", "base") || LIGHT_TOKENS["--accent"],
      line: readHex(previewColors, "identity", "pear") || LIGHT_TOKENS["--pear"]
    },
    captions: { light: "", dark: "" },
    tokens: { light: lightTokens, dark: darkTokens },
    typefaces,
    fixedScheme: version === 2 ? "" : scheme, // v2 双态留空，v1 单态锁死明暗
    replace: true,
    user: true
  };
  const contractErrors = validateThemeDefinition(definition);
  if (contractErrors.length) {
    return { errors: contractErrors, raw, definition: null };
  }
  return { errors: [], raw, definition };
}

/** 解析主题文件文本（JSON），返回 { errors, raw, definition }。 */
export function parseJsonThemeFile(text) {
  let raw = null;
  try {
    raw = JSON.parse(text);
  } catch {
    return { errors: ["文件不是有效的 JSON"], raw: null, definition: null };
  }
  return buildUserThemeDefinition(raw);
}

// ---- 本机持久化（localStorage，键 clawbox-user-themes-v1） ----

function readStore(safeStorage) {
  const storage = safeStorage || createSafeStorage();
  let parsed = null;
  try {
    parsed = JSON.parse(storage.getItem(STORAGE_KEYS.userThemes) || "");
  } catch { /* 损坏数据按空处理 */ }
  const themes = parsed && Array.isArray(parsed.themes) ? parsed.themes : [];
  return { storage, themes: themes.filter((entry) => entry && typeof entry === "object" && entry.id) };
}

function writeStore(storage, themes) {
  try {
    storage.setItem(STORAGE_KEYS.userThemes, JSON.stringify({ version: 1, themes }));
  } catch { /* 存储不可用：仅本次会话有效 */ }
}

export function listUserThemeFiles(safeStorage) {
  return readStore(safeStorage).themes.map((entry) => ({ ...entry }));
}

export function saveUserThemeFile({ id, raw }, safeStorage) {
  const { storage, themes } = readStore(safeStorage);
  const kept = themes.filter((entry) => entry.id !== id);
  if (kept.length >= MAX_USER_THEMES) {
    throw new Error(`最多保存 ${MAX_USER_THEMES} 个自定义主题，请先删除不再使用的`);
  }
  kept.push({ id, savedAt: Date.now(), raw });
  writeStore(storage, kept);
  return { id, savedAt: kept[kept.length - 1].savedAt, raw };
}

export function removeUserThemeFile(id, safeStorage) {
  const { storage, themes } = readStore(safeStorage);
  const next = themes.filter((entry) => entry.id !== id);
  if (next.length === themes.length) return false;
  writeStore(storage, next);
  return true;
}

/** 主题包迁移完成后移除旧 localStorage 整表，避免同一主题出现两份来源。 */
export function clearUserThemeFiles(safeStorage) {
  const storage = safeStorage || createSafeStorage();
  try {
    storage.removeItem(STORAGE_KEYS.userThemes);
  } catch { /* 存储不可用时保持当前会话主题即可 */ }
}

/** 启动时恢复：逐个解析注册，单个损坏不影响其余。返回成功恢复的 ID 列表。 */
export function restoreUserThemes(safeStorage) {
  const restored = [];
  for (const entry of readStore(safeStorage).themes) {
    const { errors, definition } = buildUserThemeDefinition(entry.raw);
    if (errors.length || !definition) {
      console.error(`[ai-chatbox Theme] 无法恢复自定义主题 ${entry.id}：${errors.join("；")}`);
      continue;
    }
    try {
      registerTheme(definition, { replace: true });
      restored.push(definition.id);
    } catch (error) {
      console.error(`[ai-chatbox Theme] 注册自定义主题 ${entry.id} 失败`, error);
    }
  }
  return restored;
}
