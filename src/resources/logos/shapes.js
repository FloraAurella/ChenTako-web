import { resources, registerSystem } from '../registry.js';
import aiChatboxLogoSvg from './ai-chatbox.svg?raw';
"use strict";

/**
 * 品牌 Logo 的可信源码注册表。ai-chatbox.svg 是默认标志唯一图形源：
 * 应用内标志、HTML 首帧 favicon 与主题 favicon 都从它派生。
 * 后续换标只需替换该 SVG，并保持 24×24 viewBox、currentColor 与安全元素约束。
 */

// paper-pen 是已存储的形状 ID；更换图形不使旧主题选择失效。
export const LOGO_SHAPES = Object.freeze({
  "paper-pen": aiChatboxLogoSvg
});

export const DEFAULT_LOGO_SHAPE = "paper-pen";

registerSystem('logo', LOGO_SHAPES);

const SAFE_LOGO_ELEMENTS = /^(?:\s|<\/?(?:path|g)(?:\s[^<>]*)?>)*$/i;
const FORBIDDEN_LOGO_CONTENT = /<(?:script|style|foreignObject|image|use|a)\b|\bon\w+\s*=|\b(?:href|src|style)\s*=|\burl\s*\(/i;
const SAFE_FILL = /^(?:currentColor|#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8}))$/i;

function readLogoSource(source) {
  if (typeof source !== "string" || FORBIDDEN_LOGO_CONTENT.test(source)) throw new Error("Unsafe logo resource");
  const match = source.match(/^\s*<svg\b[^>]*\bviewBox=["']0 0 24 24["'][^>]*>([\s\S]*?)<\/svg>\s*$/i);
  const markup = match?.[1]?.trim();
  if (!markup || !SAFE_LOGO_ELEMENTS.test(markup)) throw new Error("Invalid logo resource");
  return markup;
}

function safeFill(value) {
  const fill = String(value || "currentColor");
  return SAFE_FILL.test(fill) ? fill : "currentColor";
}

export function isValidLogoShape(value) {
  return typeof value === "string" && Object.hasOwn(LOGO_SHAPES, value);
}

/** SVG 内部图形；currentColor 由应用品牌令牌或主题 favicon 身份色接管。 */
export function logoSvgPaths(shape = DEFAULT_LOGO_SHAPE, bodyFill = "currentColor", accentFill = bodyFill) {
  void accentFill;
  const source = resources.resolve(`logo/${shape}`, LOGO_SHAPES[DEFAULT_LOGO_SHAPE]);
  return readLogoSource(source).replaceAll("currentColor", safeFill(bodyFill));
}

/** 完整 SVG（xmlns 供主题 favicon data URI 使用）。 */
export function renderLogoSvg(shape = DEFAULT_LOGO_SHAPE, bodyFill = "currentColor", accentFill = bodyFill) {
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>${logoSvgPaths(shape, bodyFill, accentFill)}</svg>`;
}
