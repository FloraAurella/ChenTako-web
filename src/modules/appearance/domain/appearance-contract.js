"use strict";

/** 主题 JSON 与运行时共享的最小外观契约。 */
export const DEFAULT_THEME_CONTRAST = 60;

export function clampThemeContrast(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(100, Math.max(0, Math.round(number)))
    : DEFAULT_THEME_CONTRAST;
}

function normalizeVariant(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    contrast: clampThemeContrast(source.contrast),
    transparent: source.transparent === true
  };
}

export function normalizeThemeAppearance(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    light: normalizeVariant(source.light),
    dark: normalizeVariant(source.dark)
  };
}
