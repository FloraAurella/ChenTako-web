"use strict";

/**
 * 单主题便携文件（JSON）。
 *
 * v1 只保存主题定义与两套外观偏好，不携带图片、动效脚本或其它资源。
 * 背景始终由主题的纯色画布令牌决定；对比度与透景模式由应用统一渲染。
 */

import { isValidThemeId, validateThemeDefinition } from "./contract.js";
import { deriveThemeId, parseJsonThemeFile } from "./user-theme.js";
import { normalizeThemeAppearance } from "./appearance-contract.js";

export const THEME_PACKAGE_EXTENSION = "json";
export const THEME_PACKAGE_KIND = "clawbox-theme-package";
export const THEME_PACKAGE_VERSION = 1;
export const THEME_PACKAGE_MAX_BYTES = 512 * 1024;
const encoder = new TextEncoder();

/**
 * 导出时只保留稳定的声明式主题数据。motion 属于已经封存的背景动效能力，
 * 不进入新的 JSON 文件。
 */
export function serializableThemeDefinition(theme) {
  return {
    id: String(theme?.id || ""),
    label: String(theme?.label || ""),
    note: String(theme?.note || ""),
    ...(theme?.baseTheme ? { baseTheme: theme.baseTheme } : {}),
    preview: { ...(theme?.preview || {}) },
    captions: { ...(theme?.captions || {}) },
    tokens: {
      light: { ...((theme?.tokens && theme.tokens.light) || {}) },
      dark: { ...((theme?.tokens && theme.tokens.dark) || {}) }
    },
    ...(theme?.typefaces ? { typefaces: { ...theme.typefaces } } : {}),
    fixedScheme: theme?.fixedScheme || "",
    replace: false
  };
}

export function createThemePackage(theme, appearance) {
  let definition = serializableThemeDefinition(theme);
  if (!isValidThemeId(definition.id)) {
    definition = serializableThemeDefinition({
      ...theme,
      id: deriveThemeId(String((theme && theme.label) || "theme"))
    });
  }
  const errors = validateThemeDefinition(definition);
  if (errors.length) throw new Error(`当前主题无法导出：${errors.join("；")}`);
  return {
    kind: THEME_PACKAGE_KIND,
    version: THEME_PACKAGE_VERSION,
    theme: definition,
    appearance: normalizeThemeAppearance(appearance)
  };
}

function parseJson(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("主题 JSON 为空");
  if (encoder.encode(text).length > THEME_PACKAGE_MAX_BYTES) throw new Error("主题 JSON 超过大小限制");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("主题 JSON 解析失败");
  }
}

/**
 * 读取新的 JSON 主题包，也兼容原有 clawbox-theme / tribblebook-theme JSON 配置。
 * .peratheme 二进制容器不再进入此解析器。
 */
export function parseThemePackage(text) {
  const raw = parseJson(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("主题 JSON 必须是对象");

  if (raw.kind === THEME_PACKAGE_KIND) {
    if (raw.version !== THEME_PACKAGE_VERSION) throw new Error("主题 JSON 版本不受支持");
    if ("background" in raw || "backgrounds" in raw || "files" in raw) {
      throw new Error("主题 JSON 不支持自定义背景或附件");
    }
    if (raw.theme && typeof raw.theme === "object" && "motion" in raw.theme) {
      throw new Error("主题 JSON 不支持背景动效");
    }
    for (const variant of [raw.appearance?.light, raw.appearance?.dark]) {
      if (variant && typeof variant === "object" && ["image", "blur", "tint", "width", "height"].some((key) => key in variant)) {
        throw new Error("主题 JSON 不支持自定义背景或独立背景效果");
      }
    }
    const definition = serializableThemeDefinition(raw.theme);
    const errors = validateThemeDefinition(definition);
    if (errors.length) throw new Error(`主题配置无效：${errors.join("；")}`);
    return {
      definition,
      appearance: normalizeThemeAppearance(raw.appearance),
      source: "package"
    };
  }

  if (raw.kind === "clawbox-portable-theme" || raw.kind === "tribblebook-portable-theme") {
    throw new Error(".peratheme 主题包已弃用，请导入 JSON 主题文件");
  }

  const legacy = parseJsonThemeFile(text);
  if (legacy.errors.length || !legacy.definition) {
    throw new Error(legacy.errors.join("；") || "主题配置无效");
  }
  return {
    definition: serializableThemeDefinition(legacy.definition),
    appearance: normalizeThemeAppearance(null),
    source: "legacy-json"
  };
}

export function serializeThemePackage(payload) {
  if (!payload || payload.kind !== THEME_PACKAGE_KIND || payload.version !== THEME_PACKAGE_VERSION) {
    throw new Error("主题 JSON 版本不受支持");
  }
  const validated = createThemePackage(payload.theme, payload.appearance);
  const text = `${JSON.stringify(validated, null, 2)}\n`;
  if (encoder.encode(text).length > THEME_PACKAGE_MAX_BYTES) throw new Error("主题 JSON 超过大小限制");
  return text;
}

export function themePackageFilename(theme) {
  const id = isValidThemeId(theme?.id) ? theme.id : "theme";
  return `Clawbox-${id}.${THEME_PACKAGE_EXTENSION}`;
}

export function downloadThemePackage(text, filename) {
  const blob = new Blob([String(text)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
