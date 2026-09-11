import { resources, registerSystem } from '../registry.js';
"use strict";

/** 内联 SVG 图标集（24 视窗 · 描线风格 · currentColor）。品牌标剪影见 themes/logo-shapes.js。 */

import { logoSvgPaths } from "../logos/shapes.js";

const PATHS = {
  folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  bolt: '<path d="m13 3-8 11h6l-1 7 9-12h-7l1-6Z" fill="currentColor" stroke-linejoin="round"/>',
  sidebarOpen: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m4-11 3 3-3 3"/>',
  sidebarClose: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m7-11-3 3 3 3"/>',
  newChat: '<path d="M20 11.5a8 8 0 0 1-8 8H5l-2 2v-10a8 8 0 0 1 16-4M12 7v8M8 11h8"/>',
  connection: '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="m9 11 6-4m-6 6 6 4"/>',
  chat: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4.2 3.4c-.5.4-1.3 0-1.3-.7V6.5Z"/>',
  work: '<rect x="3.5" y="7" width="17" height="12.5" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12h17"/>',
  puzzle: '<path d="M8.7 4.2h2.1a2.1 2.1 0 1 1 4.2 0h2.1a1.8 1.8 0 0 1 1.8 1.8v2.3a2.1 2.1 0 1 0 0 4.2V15a1.8 1.8 0 0 1-1.8 1.8h-2.3a2.1 2.1 0 1 0-4.2 0H8.7A1.8 1.8 0 0 1 6.9 15v-2.3a2.1 2.1 0 1 0 0-4.2V6a1.8 1.8 0 0 1 1.8-1.8Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.15-1.4l1.8-1.3-1.8-3.1-2.1.8a7 7 0 0 0-2.4-1.4L14.1 3h-4.2l-.25 2.6a7 7 0 0 0-2.4 1.4l-2.1-.8-1.8 3.1 1.8 1.3a7 7 0 0 0 0 2.8l-1.8 1.3 1.8 3.1 2.1-.8a7 7 0 0 0 2.4 1.4l.25 2.6h4.2l.25-2.6a7 7 0 0 0 2.4-1.4l2.1.8 1.8-3.1-1.8-1.3A7 7 0 0 0 19 12Z"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.8 2-1.8 0-1.6-1.3-1.8-1.3-3 0-1 .8-1.7 2-1.7h1.8a4 4 0 0 0 4-4c0-3.9-3.8-6.5-8.5-6.5Z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="7.3" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="7.3" r="1.1" fill="currentColor" stroke="none"/>',
  lightDark: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17V3.5Z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  import: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M3 12h11m-4-4 4 4-4 4"/>',
  export: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m0-8h11m-4-4 4 4-4 4"/>',
  pin: '<path d="M9 4h6l-.7 5.2 3 3.3H15a9 9 0 0 1-1.5 4.9L12 20.5l-1.5-3.1A9 9 0 0 1 9 12.5H6.7l3-3.3L9 4Z"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.5 6.5 3 3"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6V4.5A1.5 1.5 0 0 1 11 3h2a1.5 1.5 0 0 1 1.5 1.5V6m-8 0 .8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12M10 10.5v6M14 10.5v6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/>',
  code: '<path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5l-3 14"/>',
  play: '<path d="M8 5.5v13l10-6.5L8 5.5Z"/>',
  branch: '<circle cx="7" cy="5.5" r="2"/><circle cx="7" cy="18.5" r="2"/><circle cx="17" cy="8" r="2"/><path d="M7 7.5v9M9 18.5h3.2a2.3 2.3 0 0 0 2.3-2.3V10"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
  send: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  paperclip: '<path d="m20 11.5-7.8 7.8a5 5 0 0 1-7-7L13 4.4a3.3 3.3 0 0 1 4.7 4.7l-7.8 7.8a1.7 1.7 0 0 1-2.4-2.4l7.1-7"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.6"/><path d="m5 18 4.8-4.8a1.5 1.5 0 0 1 2.1 0L16 17.3m1.2-1.6 1-1a1.5 1.5 0 0 1 2.1 0L20.5 16"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  spark: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8L12 3.5Z"/><path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z"/>',
  chart: '<circle cx="12" cy="12" r="8.5"/><path d="M12 12 12 6"/><path d="M12 12l4.5 3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M13.5 9.5 16 12"/>',
  database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.3l3.4 2"/>',
  alert: '<path d="M12 4 3 19.5h18L12 4Z"/><path d="M12 10v4M12 16.8v.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5m14 0h2.5M5.3 5.3 7 7m10 10 1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7"/>',
  moon: '<path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z"/>',
  monitor: '<rect x="3.5" y="4.5" width="17" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/>',
  download: '<path d="M12 4v11m0 0 4-4m-4 4-4-4M4.5 17.5v.5A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-.5"/>',
  upload: '<path d="M12 15V4m0 0 4 4m-4-4-4 4M4.5 17.5v.5A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-.5"/>',
  more: '<circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  file: '<path d="M6 3.5h8L19 8.5v12H6v-17Z"/><path d="M13.5 3.5v5.5H19"/>',
  filter: '<path d="M4 6h16M7 12h10m-7 6h4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  leaf: '<path d="M5 19C5 11 11 5 19.5 4.5 20 13 14 19 6.5 19.5"/><path d="M5 19c3-5 7-9 11.5-11.5"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6l-7-2.5Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4" rx="1"/><path d="M5 8.5v9A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-9M10 12h4"/>',
  book: '<path d="M5 4.5h6a2.5 2.5 0 0 1 2.5 2.5v12A2 2 0 0 0 11.5 17H5v-12.5Z"/><path d="M19 4.5h-4.5A2.5 2.5 0 0 0 12 7v12a2 2 0 0 1 2-2h5v-12.5Z"/>'
};

registerSystem('icon', PATHS);

export function icon(name, size = 18, className = "") {
  const path = resources.resolve(`icon/${name}`, PATHS.info);
  const cls = className ? ` class="${className}"` : "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${size < 18 ? 2.1 : 1.9}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls}>${path}</svg>`;
}

/**
 * 品牌标（Clawbox）。单色剪影继承 currentColor；品牌块在浅色主题
 * 使用亮色标、深色主题使用深色标，均由 --on-brand-logo 负责对比度。
 */
export function pearLogo(size = 22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${logoSvgPaths()}</svg>`;
}

export const ICON_NAMES = Object.keys(PATHS);
