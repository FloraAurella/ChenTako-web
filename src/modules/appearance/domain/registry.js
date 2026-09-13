"use strict";

/**
 * 主题注册表。默认主题 Everforest 由
 * custom/everforest.theme.js 注册，
 * 运行时可经 AiChatboxThemeAPI 或其他 custom/*.theme.js 注册新主题。
 * 色板与 tokens.css 保持一致；未钉入的令牌回落到样式表基线。
 * 内置色板的数值定义统一在 ./base-themes.js（唯一色板数据源）。
 */

import { isValidThemeId } from "./contract.js";

/** 内置主题（空数组，默认主题来自 sourceCustom 通道）。 */
const BUILT_IN_THEMES = [];

/**
 * 产品随附主题的稳定顺序。默认回退、外观卡片与快速换肤都经 listThemes() 读取，
 * 因此不能把顺序交给 import.meta.glob、档案文件或用户导入时机决定。
 */
export const SOURCE_THEME_ORDER = Object.freeze(["everforest"]);
const SOURCE_THEME_RANK = new Map(SOURCE_THEME_ORDER.map((id, index) => [id, index]));

const registry = new Map();
const registryListeners = new Set();

function notifyRegistry(detail) {
  for (const listener of registryListeners) {
    try {
      listener(detail);
    } catch (error) {
      console.error("[ai-chatbox Theme] registry listener error", error);
    }
  }
}

export function registerTheme(definition, {
  replace = false,
  builtin = false,
  archiveManaged = false,
  removable = false,
  user = false,
  sourceCustom = false,
  forceBuiltinChange = false
} = {}) {
  if (!definition || typeof definition !== "object") {
    throw new Error("[ai-chatbox Theme] 主题定义缺失");
  }
  if (!isValidThemeId(definition.id)) {
    throw new Error(`[ai-chatbox Theme] 非法主题 ID：${definition.id}`);
  }
  const existing = registry.get(definition.id);
  if (existing && !(replace || definition.replace)) {
    throw new Error(`[ai-chatbox Theme] 主题 ${definition.id} 已注册；如需覆盖请声明 replace`);
  }
  const nextBuiltin = forceBuiltinChange
    ? builtin
    : (existing ? existing.builtin || builtin : builtin);
  registry.set(definition.id, Object.freeze({
    ...definition,
    builtin: nextBuiltin,
    archiveManaged: archiveManaged || definition.archiveManaged === true || existing?.archiveManaged === true,
    removable: removable || definition.removable === true || existing?.removable === true,
    user: user || definition.user === true || existing?.user === true,
    sourceCustom: sourceCustom || definition.sourceCustom === true || existing?.sourceCustom === true
  }));
  notifyRegistry({ type: existing ? "replace" : "register", id: definition.id });
  return definition;
}

export function listThemes() {
  return [...registry.values()]
    .map((theme, index) => ({ theme, index }))
    .sort((left, right) => {
      const leftRank = SOURCE_THEME_RANK.get(left.theme.id);
      const rightRank = SOURCE_THEME_RANK.get(right.theme.id);
      if (leftRank !== undefined || rightRank !== undefined) {
        if (leftRank === undefined) return 1;
        if (rightRank === undefined) return -1;
        return leftRank - rightRank;
      }
      return left.index - right.index;
    })
    .map(({ theme }) => theme);
}

export function getTheme(id) {
  return registry.get(String(id || "")) || null;
}

/** 注销主题；内置主题默认受保护，主题包恢复/删除时可显式 force。 */
export function unregisterTheme(id, { force = false } = {}) {
  const theme = registry.get(String(id || ""));
  if (!theme) return false;
  if (theme.builtin && !force) {
    throw new Error(`[ai-chatbox Theme] 内置主题 ${theme.id} 不能注销`);
  }
  registry.delete(theme.id);
  notifyRegistry({ type: "remove", id: theme.id });
  return true;
}

export function resolveTheme(id) {
  return getTheme(id) || listThemes()[0] || BUILT_IN_THEMES[0];
}

export function subscribeThemeRegistry(listener) {
  registryListeners.add(listener);
  return () => registryListeners.delete(listener);
}

// 注册内置主题
BUILT_IN_THEMES.forEach((theme) => registerTheme(theme, { builtin: true }));

export const BUILTIN_THEME_IDS = BUILT_IN_THEMES.map((theme) => theme.id);

/** 返回不含注册表元数据的内置主题定义，供首次生成主题包使用。 */
export function getBuiltInThemeDefinitions() {
  return BUILT_IN_THEMES.map((theme) => ({
    id: theme.id,
    label: theme.label,
    note: theme.note,
    ...(theme.baseTheme ? { baseTheme: theme.baseTheme } : {}),
    preview: { ...theme.preview },
    captions: { ...theme.captions },
    tokens: {
      light: { ...theme.tokens.light },
      dark: { ...theme.tokens.dark }
    },
    ...(theme.typefaces ? { typefaces: { ...theme.typefaces } } : {}),
    fixedScheme: theme.fixedScheme,
    replace: false
  }));
}
