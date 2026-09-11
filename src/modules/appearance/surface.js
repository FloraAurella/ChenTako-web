"use strict";

/**
 * 纯色画布上的表面外观偏好。
 *
 * 每个主题的浅色/深色档只保存两个值：
 * - contrast：统一控制卡片与画布的分离度；
 * - transparent：决定使用实体表面还是毛玻璃表面。
 *
 * 旧图片背景数据不会被读取、迁移或删除，便于从封存实现恢复时继续使用。
 */

import { createSafeStorage } from "../../shared/storage/safe-storage.js";
import { STORAGE_KEYS } from "../../contracts/constants.js";
import { isValidThemeId } from "./domain/contract.js";
import {
  clampThemeContrast,
  DEFAULT_THEME_CONTRAST,
  normalizeThemeAppearance
} from "./domain/appearance-contract.js";

export const APPEARANCE_CONTRAST_MIN = 0;
export const APPEARANCE_CONTRAST_MAX = 100;
export const DEFAULT_SURFACE_APPEARANCE = Object.freeze({
  contrast: DEFAULT_THEME_CONTRAST,
  transparent: false
});

let storage = createSafeStorage();
let cache = null;

function clampContrast(value) {
  return clampThemeContrast(value);
}

function normalizeVariant(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    contrast: clampContrast(source.contrast),
    transparent: source.transparent === true
  };
}

function loadThemes() {
  if (cache) return cache;
  let parsed = null;
  try {
    parsed = JSON.parse(storage.getItem(STORAGE_KEYS.themeAppearance) || "");
  } catch { /* 损坏的外观偏好按空表处理 */ }
  const source = parsed && typeof parsed === "object" && parsed.themes && typeof parsed.themes === "object"
    ? parsed.themes
    : {};
  cache = {};
  for (const [themeId, value] of Object.entries(source)) {
    if (!isValidThemeId(themeId)) continue;
    cache[themeId] = normalizeThemeAppearance(value);
  }
  return cache;
}

function persist() {
  try {
    storage.setItem(STORAGE_KEYS.themeAppearance, JSON.stringify({
      version: 1,
      themes: loadThemes(),
      savedAt: Date.now()
    }));
  } catch { /* 安全存储会保留内存副本；此处不阻塞界面 */ }
}

export function resolveActiveThemeId(doc = typeof document !== "undefined" ? document : null) {
  const id = doc?.documentElement?.dataset?.theme || "";
  return isValidThemeId(id) ? id : "everforest";
}

export function resolveActiveScheme(doc = typeof document !== "undefined" ? document : null) {
  return doc?.documentElement?.dataset?.scheme === "dark" ? "dark" : "light";
}

export function readSurfaceAppearance(themeId, scheme) {
  const id = isValidThemeId(themeId) ? themeId : resolveActiveThemeId();
  const selectedScheme = scheme === "dark" ? "dark" : scheme === "light" ? "light" : resolveActiveScheme();
  const record = loadThemes()[id];
  return record?.[selectedScheme]
    ? { ...record[selectedScheme] }
    : { ...DEFAULT_SURFACE_APPEARANCE };
}

export function writeSurfaceAppearance(themeId, scheme, partial) {
  const id = isValidThemeId(themeId) ? themeId : resolveActiveThemeId();
  const selectedScheme = scheme === "dark" ? "dark" : scheme === "light" ? "light" : resolveActiveScheme();
  const themes = loadThemes();
  const current = themes[id] || normalizeThemeAppearance(null);
  current[selectedScheme] = normalizeVariant({ ...current[selectedScheme], ...partial });
  themes[id] = current;
  persist();
  return { ...current[selectedScheme] };
}

export function replaceThemeAppearance(themeId, appearance) {
  if (!isValidThemeId(themeId)) throw new Error("主题 ID 无效");
  loadThemes()[themeId] = normalizeThemeAppearance(appearance);
  persist();
  return normalizeThemeAppearance(appearance);
}

export function removeThemeAppearance(themeId) {
  const id = String(themeId || "");
  const themes = loadThemes();
  if (!themes[id]) return false;
  delete themes[id];
  persist();
  return true;
}

function derivedMaterial(contrast, transparent) {
  const ratio = clampContrast(contrast) / APPEARANCE_CONTRAST_MAX;
  if (!transparent) {
    return {
      panel: `color-mix(in srgb, var(--surface-content) ${Math.round(58 + ratio * 42)}%, var(--canvas-mid))`,
      strong: `color-mix(in srgb, var(--surface-content) ${Math.round(72 + ratio * 28)}%, var(--canvas-mid))`,
      filter: "none"
    };
  }
  return {
    panel: `color-mix(in srgb, var(--surface-content) ${Math.round(42 + ratio * 46)}%, transparent)`,
    strong: `color-mix(in srgb, var(--surface-content) ${Math.round(62 + ratio * 34)}%, transparent)`,
    filter: `blur(${(8 + ratio * 16).toFixed(1)}px) saturate(${Math.round(110 + ratio * 40)}%)`
  };
}

export function applySurfaceAppearance(doc = typeof document !== "undefined" ? document : null) {
  if (!doc) return;
  const prefs = readSurfaceAppearance(resolveActiveThemeId(doc), resolveActiveScheme(doc));
  const material = derivedMaterial(prefs.contrast, prefs.transparent);
  const root = doc.documentElement;
  root.style.setProperty("--appearance-contrast", String(prefs.contrast));
  root.style.setProperty("--appearance-panel-bg", material.panel);
  root.style.setProperty("--appearance-panel-strong-bg", material.strong);
  root.style.setProperty("--appearance-backdrop-filter", material.filter);
  root.classList.toggle("transparency-mode", prefs.transparent);
}

export function setSurfaceContrast(value, themeId, scheme) {
  const prefs = writeSurfaceAppearance(themeId, scheme, { contrast: value });
  applySurfaceAppearance();
  return prefs.contrast;
}

export function setTransparentMode(enabled, themeId, scheme) {
  const prefs = writeSurfaceAppearance(themeId, scheme, { transparent: enabled === true });
  applySurfaceAppearance();
  return prefs.transparent;
}

export const __surfaceAppearanceTest = Object.freeze({
  clampContrast,
  derivedMaterial,
  reset() {
    cache = null;
    storage = createSafeStorage();
  }
});
