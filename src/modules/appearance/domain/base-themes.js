"use strict";

/**
 * 默认主题运行时基线 —— Everforest。
 *
 * 本文件负责首帧、favicon、预览 iframe 和未覆盖令牌的稳定兜底；
 * examples/everforest-ai-chatbox-theme-v1.json 是唯一色板数据源，tokens.css 是其
 * 样式表镜像，保证 JavaScript 接管前不会闪现已退役主题。
 */

import { defaultThemePackage } from "../../../resources/themes/default.js";
const themePackage = defaultThemePackage();
import { renderLogoSvg, DEFAULT_LOGO_SHAPE } from "../../../resources/logos/shapes.js";

export const LIGHT_TOKENS = Object.freeze({ ...themePackage.theme.tokens.light });
export const DARK_TOKENS = Object.freeze({ ...themePackage.theme.tokens.dark });

/** 默认源码主题预览，与可导入 JSON 的预览一致。 */
export const BUILTIN_THEME_PREVIEWS = Object.freeze({
  everforest: Object.freeze({ ...themePackage.theme.preview })
});

/** 主题 favicon 使用单一路径与单一身份色。 */
export function themeFaviconDataUri(pear = LIGHT_TOKENS["--pear"]) {
  const svg = renderLogoSvg(DEFAULT_LOGO_SHAPE, pear);
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
