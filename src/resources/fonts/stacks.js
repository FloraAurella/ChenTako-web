import { resources, registerSystem } from '../registry.js';
"use strict";

/**
 * 主题字体栈注册表（唯一数据源）。
 *
 * 主题包的 typefaces 字段从下列栈 ID 中选择（body / display / mono 三个角色），
 * 全部为系统字体栈（本地优先，不加载网络字体），多平台 CJK 回退齐全。
 * 栈只定义家族，字号/行距字体标度仍属布局协议，主题不可覆盖。
 */

export const FONT_ROLES = Object.freeze(["body", "display", "mono"]);

export const FONT_STACKS = Object.freeze({
  // 系统默认无衬线（旧默认正文）：可选回退到无衬线风格的 UI
  sans: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Helvetica Neue\", \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", system-ui, sans-serif",
  // 展示衬线（现状 --font-display）：空状态大标题 / 主题名 / 阅读模式；现为全局默认
  serif: "\"New York\", ui-serif, \"Songti SC\", \"Noto Serif SC\", Georgia, serif",
  // 宋体系正文：纸面感强，适合长文阅读
  songti: "\"Songti SC\", \"Noto Serif SC\", \"SimSun\", STSong, serif",
  // 圆体系：元圆 / 明圆 / PingFang，柔和儿童向
  rounded: "\"Yuanti SC\", \"Hiragino Maru Gothic ProN\", \"Varela Round\", \"PingFang SC\", sans-serif",
  // 人文无衬线：Avenir / Trebuchet 系西文 + PingFang 中文
  humanist: "\"Avenir Next\", \"Avenir\", \"Trebuchet MS\", \"PingFang SC\", system-ui, sans-serif",
  // 等宽（现状 --font-mono）：代码块 / 元数据 / 徽标
  mono: "\"SF Mono\", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
});

/** 各角色默认栈：衬线已成为全局默认（正文与大标题同族，靠字号/字重分层），
 *  sans / humanist / rounded 等仍可通过主题 typefaces 切换。 */
export const DEFAULT_TYPEFACES = Object.freeze({
  body: "serif",
  display: "serif",
  mono: "mono"
});

registerSystem('font', FONT_STACKS);

export function isValidTypefaceRole(value) {
  return typeof value === "string" && FONT_ROLES.includes(value);
}

export function isValidTypefaceStack(value) {
  return typeof value === "string" && Object.hasOwn(FONT_STACKS, value);
}

/** 规范化 typefaces（缺省角色补默认值），非法角色/栈由契约校验拦截。 */
export function normalizeTypefaces(source) {
  const raw = source && typeof source === "object" ? source : {};
  const result = {};
  for (const role of FONT_ROLES) {
    result[role] = isValidTypefaceStack(raw[role]) ? raw[role] : DEFAULT_TYPEFACES[role];
  }
  return result;
}

/** 把选中的字体栈写入 CSS 令牌（mono 角色同时覆盖 --font-mono / --font-code）。 */
export function applyTypefacesToTokens(typefaces, tokens) {
  const normalized = normalizeTypefaces(typefaces);
  tokens["--font-body"] = resources.resolve(`font/${normalized.body}`, FONT_STACKS[normalized.body]);
  tokens["--font-display"] = resources.resolve(`font/${normalized.display}`, FONT_STACKS[normalized.display]);
  tokens["--font-mono"] = resources.resolve(`font/${normalized.mono}`, FONT_STACKS[normalized.mono]);
  tokens["--font-code"] = resources.resolve(`font/${normalized.mono}`, FONT_STACKS[normalized.mono]);
  return tokens;
}
