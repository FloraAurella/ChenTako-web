import { resources, registerSystem } from '../registry.js';
"use strict";

/**
 * 品牌 logo 剪影注册表（唯一数据源）。
 * 每个形状 = 主剪影 path + 可选点缀 path；
 * 应用内品牌标（icons.js，fill=currentColor 随 --on-brand-logo）
 * 与 favicon（base-themes.js，fill=pear）共用此注册表，
 * 避免同一形状在两处各维护一份。
 */

export const LOGO_SHAPES = Object.freeze({
  "tribble-book": {
    // 单一剪影同时构成方形 Tribble 与打开的书；眼睛和页纹由 evenodd 负空间刻出。
    body: "M9 3h2V2h4v2h2v1h2v7h3v8h-7v-1h-3v2h-2v-2H7v1H2v-8h3V5h2V4h2V3Z M8 8h2v2H8V8Z M14 8h2v2h-2V8Z M4 14h5v1H5v2h4v1H4v-4Z M20 14h-5v1h4v2h-4v1h5v-4Z",
    accent: "",
    fillRule: "evenodd"
  },
  leaf: {
    body: "M12 5.1c1.2 0 1.9 1 2.1 2.2 2.9 1.2 4.9 4 4.9 7.4 0 4.5-3.1 8.2-7 8.2s-7-3.7-7-8.2c0-3.4 2-6.2 4.9-7.4C10.1 6.1 10.8 5.1 12 5.1z",
    accent: "M13.2 4.9c.2-1.8 1.5-3.2 3.3-3.5 1.5-.3 3 .3 3.7 1.4-.8 1.2-2.2 2-3.8 2-1.2 0-2.3.1-3.2.1z"
  },
  wave: {
    body: "M2 9.6C5.4 7.4 8.6 7.4 12 9.6C15.4 11.8 18.6 11.8 22 9.6L22 12.2C18.6 14.4 15.4 14.4 12 12.2C8.6 10 5.4 10 2 12.2Z M2 14.8C5.4 12.6 8.6 12.6 12 14.8C15.4 17 18.6 17 22 14.8L22 17.4C18.6 19.6 15.4 19.6 12 17.4C8.6 15.2 5.4 15.2 2 17.4Z",
    accent: "M16.6 4.4a2.1 2.1 0 1 1 4.2 0 2.1 2.1 0 0 1-4.2 0Z"
  }
});

export const DEFAULT_LOGO_SHAPE = "tribble-book";

registerSystem('logo', LOGO_SHAPES);

export function isValidLogoShape(value) {
  return typeof value === "string" && Object.hasOwn(LOGO_SHAPES, value);
}

/** 剪影 path；fill 走调用方决定（品牌标 currentColor / favicon 主题色）。 */
export function logoSvgPaths(shape = DEFAULT_LOGO_SHAPE, bodyFill = "currentColor", accentFill = bodyFill) {
  const picked = resources.resolve(`logo/${shape}`, LOGO_SHAPES[DEFAULT_LOGO_SHAPE]);
  const fillRule = picked.fillRule ? ` fill-rule='${picked.fillRule}' clip-rule='${picked.fillRule}'` : "";
  const accent = picked.accent ? `<path fill='${accentFill}' d='${picked.accent}'/>` : "";
  return `<path fill='${bodyFill}'${fillRule} d='${picked.body}'/>${accent}`;
}

/** 完整剪影 SVG（xmlns 供 favicon data URI 使用）。 */
export function renderLogoSvg(shape = DEFAULT_LOGO_SHAPE, bodyFill = "currentColor", accentFill = bodyFill) {
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>${logoSvgPaths(shape, bodyFill, accentFill)}</svg>`;
}
