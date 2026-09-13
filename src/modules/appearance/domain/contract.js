"use strict";

/**
 * 版本化主题契约 v1：令牌白名单 + 安全校验。
 * 白名单覆盖双主题色板（含身份色 / 环境材质 / 虹彩令牌）与
 * 暖调代码框令牌。自定义主题经 defineTheme() 校验后才能注册。
 */

import { FONT_ROLES, FONT_STACKS, DEFAULT_TYPEFACES, isValidTypefaceRole, isValidTypefaceStack } from "../../../resources/fonts/stacks.js";

export const THEME_API_VERSION = 1;

/** 仅用于读取旧主题档案；新 JSON 主题文件不会保存或执行该字段。 */
export const THEME_MOTION_MAX_CHARS = 64 * 1024;

const TOKEN_LIST = [
  // 色板（浅色 / 深色双主题）
  "--canvas-start", "--canvas-mid", "--canvas-end",
  "--surface-content", "--surface-elevated",
  "--paper-subtle", "--paper-raised",
  "--label", "--label-secondary", "--label-tertiary",
  "--pear", "--pear-hover", "--on-pear",
  "--brand-logo", "--on-brand-logo",
  "--user-bubble-bg", "--user-bubble-border", "--on-user-bubble",
  "--accent", "--accent-hover", "--accent-pressed", "--accent-soft",
  "--context", "--context-soft", "--context-strong", "--fill-selected",
  "--focus-ring", "--on-accent",
  "--separator", "--separator-strong",
  "--destructive", "--warning", "--success",
  "--shadow-ink", "--shadow-ink-strong", "--vignette",
  // 控件效果 / 浮层 / 图片编码 / 分组身份色
  "--control-highlight", "--control-highlight-strong", "--control-shadow", "--control-hover",
  "--overlay-scrim", "--overlay-text", "--overlay-control", "--overlay-shadow",
  "--image-fill",
  "--group-color-1", "--group-color-2", "--group-color-3", "--group-color-4", "--group-color-5",
  // 环境材质（颗粒 / 环境光 / 磨砂 / 虹彩）
  "--grain-opacity", "--ambient-glow",
  "--glass-bg", "--glass-strong-bg",
  "--rainbow-alpha", "--rainbow-alpha-active", "--rainbow",
  // 代码框（暖调家族色，独立体系）
  "--code-bg", "--code-border", "--code-inline-bg", "--code-inline-text",
  "--syntax-plain", "--syntax-comment", "--syntax-keyword", "--syntax-string",
  "--syntax-constant", "--syntax-entity", "--syntax-variable", "--syntax-list",
  "--syntax-quote", "--syntax-invalid",
  // 字体
  "--font-display", "--font-body", "--font-mono", "--font-code",
  // 圆角 / 动效
  "--radius-xs", "--radius-sm", "--radius-md", "--radius-lg", "--radius-capsule",
  "--paper-shadow", "--paper-shadow-raised",
  "--motion-quick", "--motion-normal", "--motion-panel",
  "--ease-out", "--ease-spring",
  // 努力度面板
  "--effort-panel", "--effort-panel-ink", "--effort-track",
  "--effort-accent", "--effort-accent-2", "--effort-max-accent", "--effort-max-start", "--effort-accent-soft", "--effort-thumb", "--effort-dot",
  // AI 回复气泡
  "--assistant-bubble-bg", "--assistant-bubble-border",
  // 按钮（主行动按钮 / 发送按钮 / 图标按钮；缺省回落行动色与文字色）
  "--btn-primary", "--btn-primary-hover", "--btn-primary-pressed", "--on-btn-primary",
  "--send-btn", "--send-btn-hover", "--send-btn-pressed", "--on-send-btn",
  "--icon-btn-ink", "--icon-btn-ink-hover", "--icon-btn-hover-bg",
  // 兼容别名（旧主题令牌）
  "--canvas", "--paper", "--ink", "--ink-soft", "--ink-muted",
  "--line", "--line-soft", "--line-strong", "--danger", "--accent-contrast"
];

export const SUPPORTED_THEME_TOKENS = new Set(TOKEN_LIST);

const THEME_ID_PATTERN = /^[a-z][a-z0-9-]{0,47}$/;
const UNSAFE_CSS_PATTERN = /[;{}<>]|url\(|expression|javascript:/i;

export function isValidThemeId(id) {
  return typeof id === "string" && THEME_ID_PATTERN.test(id);
}

function isValidCssValue(value) {
  if (typeof value !== "string") return false;
  if (!value.trim() || value.length > 300) return false;
  return !UNSAFE_CSS_PATTERN.test(value);
}

function isValidHexishColor(value) {
  return typeof value === "string" &&
    /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim());
}

/** 校验主题定义，返回错误列表（空数组 = 合法）。 */
export function validateThemeDefinition(definition) {
  const errors = [];
  if (!definition || typeof definition !== "object") {
    return ["主题定义必须是对象"];
  }
  if (!isValidThemeId(definition.id)) {
    errors.push("id 必须以小写字母开头，仅含小写字母/数字/连字符，最长 48 位");
  }
  if (typeof definition.label !== "string" || !definition.label.trim() || definition.label.length > 40) {
    errors.push("label 必填且不超过 40 字符");
  }
  if (definition.note !== undefined && (typeof definition.note !== "string" || definition.note.length > 120)) {
    errors.push("note 不能超过 120 字符");
  }
  if (definition.baseTheme !== undefined && !isValidThemeId(definition.baseTheme)) {
    errors.push("baseTheme 必须是合法主题 ID");
  }

  // 旧档案兼容：允许受限长度的字符串通过校验，恢复时会由主题控制器剥离。
  if (definition.motion !== undefined && (
    typeof definition.motion !== "string" || definition.motion.length > THEME_MOTION_MAX_CHARS
  )) {
    errors.push(`motion 必须是 ${THEME_MOTION_MAX_CHARS} 字符以内的旧版动效脚本`);
  }

  const preview = definition.preview;
  if (!preview || typeof preview !== "object") {
    errors.push("preview 必填（canvas / paper / accent / line 四色）");
  } else {
    for (const key of ["canvas", "paper", "accent", "line"]) {
      if (!isValidHexishColor(preview[key])) {
        errors.push(`preview.${key} 必须是十六进制颜色`);
      }
    }
  }

  const captions = definition.captions;
  if (captions !== undefined) {
    if (!captions || typeof captions !== "object") {
      errors.push("captions 必须是 { light, dark } 对象");
    } else {
      for (const key of ["light", "dark"]) {
        if (captions[key] !== undefined && (typeof captions[key] !== "string" || captions[key].length > 40)) {
          errors.push(`captions.${key} 不能超过 40 字符`);
        }
      }
    }
  }

  // 可选字体：每个角色（body / display / mono）从内置字体栈白名单选择
  if (definition.typefaces !== undefined) {
    if (!definition.typefaces || typeof definition.typefaces !== "object" || Array.isArray(definition.typefaces)) {
      errors.push("typefaces 必须是 { body, display, mono } 对象");
    } else {
      for (const [role, value] of Object.entries(definition.typefaces)) {
        if (!isValidTypefaceRole(role)) {
          errors.push(`不支持的字体角色：${role}（可用：${FONT_ROLES.join(" / ")}）`);
        } else if (!isValidTypefaceStack(value)) {
          errors.push(`无效的字体栈：${String(value)}（可用：${Object.keys(FONT_STACKS).join(" / ")}）`);
        }
      }
    }
  }

  const tokens = definition.tokens;
  if (tokens !== undefined) {
    if (!tokens || typeof tokens !== "object") {
      errors.push("tokens 必须是 { light, dark } 对象");
    } else {
      for (const scheme of ["light", "dark"]) {
        const map = tokens[scheme];
        if (map === undefined) continue;
        if (!map || typeof map !== "object" || Array.isArray(map)) {
          errors.push(`tokens.${scheme} 必须是令牌映射`);
          continue;
        }
        for (const [token, value] of Object.entries(map)) {
          if (!SUPPORTED_THEME_TOKENS.has(token)) {
            errors.push(`未知令牌：${token}`);
          } else if (!isValidCssValue(value)) {
            errors.push(`令牌 ${token} 的值不安全或为空`);
          }
        }
      }
    }
  }

  return errors;
}

/** 校验并冻结主题定义；不合法直接抛错。 */
export function defineTheme(definition) {
  const errors = validateThemeDefinition(definition);
  if (errors.length) {
    throw new Error(`[ChenTako Theme] 主题定义不合法：${errors.join("；")}`);
  }
  const tokens = {};
  for (const scheme of ["light", "dark"]) {
    const map = definition.tokens && definition.tokens[scheme];
    tokens[scheme] = map ? Object.freeze({ ...map }) : {};
  }
  return Object.freeze({
    id: definition.id,
    label: definition.label.trim(),
    note: typeof definition.note === "string" ? definition.note : "",
    baseTheme: definition.baseTheme || "",
    preview: Object.freeze({ ...definition.preview }),
    captions: Object.freeze({
      light: (definition.captions && definition.captions.light) || "",
      dark: (definition.captions && definition.captions.dark) || ""
    }),
    tokens: Object.freeze(tokens),
    typefaces: Object.freeze({
      body: isValidTypefaceStack(definition.typefaces?.body) ? definition.typefaces.body : DEFAULT_TYPEFACES.body,
      display: isValidTypefaceStack(definition.typefaces?.display) ? definition.typefaces.display : DEFAULT_TYPEFACES.display,
      mono: isValidTypefaceStack(definition.typefaces?.mono) ? definition.typefaces.mono : DEFAULT_TYPEFACES.mono
    }),
    replace: definition.replace === true,
    fixedScheme: definition.fixedScheme === "dark" ? "dark" : definition.fixedScheme === "light" ? "light" : ""
  });
}
