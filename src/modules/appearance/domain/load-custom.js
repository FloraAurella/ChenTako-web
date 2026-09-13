"use strict";

/**
 * 自动发现并注册 custom/*.theme.js 自定义主题（错误隔离，单个失败不影响其余）。
 */

import { getTheme, registerTheme, SOURCE_THEME_ORDER } from "./registry.js";

const modules = import.meta.glob("./custom/*.theme.js", { eager: true });
const loadedSources = new Set();

export function loadCustomThemes() {
  const loaded = [];
  const sourceRank = new Map(SOURCE_THEME_ORDER.map((id, index) => [id, index]));
  const entries = Object.entries(modules).sort((left, right) => {
    const leftId = left[1]?.default?.id || "";
    const rightId = right[1]?.default?.id || "";
    const leftRank = sourceRank.get(leftId);
    const rightRank = sourceRank.get(rightId);
    if (leftRank !== undefined || rightRank !== undefined) {
      if (leftRank === undefined) return 1;
      if (rightRank === undefined) return -1;
      return leftRank - rightRank;
    }
    return left[0].localeCompare(right[0]);
  });
  for (const [path, module] of entries) {
    try {
      const definition = module && module.default ? module.default : module;
      // React remounts can initialize another controller over the same registry.
      // Keep restored/user-edited theme values; reload a source only if removed.
      if (loadedSources.has(path) && getTheme(definition.id)) {
        loaded.push(definition.id);
        continue;
      }
      registerTheme(definition, { replace: module.replace === true, sourceCustom: true });
      loadedSources.add(path);
      loaded.push(definition.id);
    } catch (error) {
      console.error(`[ChenTako Theme] 无法加载自定义主题 ${path}`, error);
    }
  }
  return loaded;
}
