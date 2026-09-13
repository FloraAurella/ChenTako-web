"use strict";

/**
 * 色板一致性测试：防止 tokens.css（样式基线）与 themes/base-themes.js
 * （唯一色板数据源）之间发生漂移。
 *
 * 规则：
 * - base-themes 的每一个令牌都必须在 tokens.css 的浅色块中存在；
 * - tokens.css 中同名的令牌（含 dark 块覆盖）解析 var() 派生链后，
 *   计算值必须与 base-themes 令牌解析后的值完全一致；
 * - 内置主题预览四色、favicon 数据 URI、HTML 首帧回退色均须与色板一致。
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  LIGHT_TOKENS,
  DARK_TOKENS,
  BUILTIN_THEME_PREVIEWS,
  themeFaviconDataUri
} from "../src/modules/appearance/domain/base-themes.js";
import { SUPPORTED_THEME_TOKENS } from "../src/modules/appearance/domain/contract.js";

const cssSource = readFileSync(resolve("src/resources/styles/tokens.css"), "utf8");

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + 1);
  if (start < 0 || end < 0) throw new Error(`无法定位样式块：${startMarker}`);
  return source.slice(start, end);
}

function parseTokens(block) {
  const map = new Map();
  const pattern = /--([a-z0-9-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = pattern.exec(block)) !== null) {
    if (map.has(match[1])) continue;
    map.set(match[1], match[2].trim());
  }
  return map;
}

function resolveVars(value, map, depth = 0) {
  if (depth > 10) return value;
  const isMap = map instanceof Map;
  const has = (name) => (isMap ? map.has(name) : name in map);
  const get = (name) => (isMap ? map.get(name) : map[name]);
  let resolved = value.replace(/var\(--([a-z0-9-]+)\)/g, (_, name) => (
    has(name) ? get(name) : `var(--${name})`
  ));
  if (resolved !== value) resolved = resolveVars(resolved, map, depth + 1);
  return resolved;
}

const lightBlock = extractBlock(cssSource, ":root {", ':root[data-scheme="dark"]');
const darkBlock = extractBlock(cssSource, ':root[data-scheme="dark"] {', "/* JS 尚未接管");
const lightMap = parseTokens(lightBlock);
const darkMap = parseTokens(darkBlock);
const mergedDarkMap = new Map([...lightMap, ...darkMap]);
// base-themes 对象键带 "--" 前缀，统一转为无前缀 Map 便于解析
const baseMap = (tokens) => new Map(
  Object.entries(tokens).map(([key, value]) => [key.replace(/^--/, ""), value])
);

describe("色板一致性（tokens.css ↔ themes/base-themes.js）", () => {
  it("浅色基线与 LIGHT_TOKENS 完全一致（含 var 派生链）", () => {
    for (const [token, value] of Object.entries(LIGHT_TOKENS)) {
      expect(lightMap.has(token.slice(2)), `tokens.css 缺少 ${token}`).toBe(true);
      const cssValue = resolveVars(lightMap.get(token.slice(2)), lightMap);
      const baseValue = resolveVars(value, baseMap(LIGHT_TOKENS));
      expect(cssValue, `${token} 漂移`).toBe(baseValue);
    }
  });

  it("深色基线与 DARK_TOKENS 完全一致（dark 块缺失项按 :root 派生）", () => {
    for (const [token, value] of Object.entries(DARK_TOKENS)) {
      expect(darkMap.has(token.slice(2)) || lightMap.has(token.slice(2)),
        `tokens.css 深浅两处都没有 ${token}`).toBe(true);
      expect(lightMap.has(token.slice(2)), `tokens.css 浅色块缺少 ${token}`).toBe(true);
      const cssValue = resolveVars(mergedDarkMap.get(token.slice(2)), mergedDarkMap);
      const baseValue = resolveVars(value, baseMap(DARK_TOKENS));
      expect(cssValue, `${token} 深色漂移`).toBe(baseValue);
    }
  });

  it("默认主题预览四色与 Tako Festival · 章鱼烧祭 主题包一致", () => {
    expect(BUILTIN_THEME_PREVIEWS["tako-festival"]).toEqual({
      canvas: LIGHT_TOKENS["--canvas-mid"],
      paper: LIGHT_TOKENS["--surface-content"],
      line: "#D98B3A",
      accent: LIGHT_TOKENS["--pear"]
    });
  });

  it("品牌 favicon 数据 URI 使用当前身份色", () => {
    const uri = decodeURIComponent(themeFaviconDataUri().replace(/^data:image\/svg\+xml,/, ""));
    expect(uri).toContain(`stroke="${LIGHT_TOKENS["--pear"]}"`);
    expect(uri).toContain(`fill="${LIGHT_TOKENS["--pear"]}"`);
    expect(uri).not.toContain(LIGHT_TOKENS["--pear-hover"]);
    expect(uri.match(/<path/g)).toHaveLength(3);
  });

  it("HTML 首帧回退色与浅色基线一致", () => {
    // favicon 图形来自唯一 SVG，SVG 默认色与浅色身份色一致；theme-color 仍来自 HTML。
    const pear = LIGHT_TOKENS["--pear"].toLowerCase();
    const canvasMid = LIGHT_TOKENS["--canvas-mid"].toLowerCase();
    const logo = readFileSync(resolve("src/resources/logos/ChenTako.svg"), "utf8").toLowerCase();
    expect(logo).toContain(`color="${pear}"`);
    const html = readFileSync(resolve("index.html"), "utf8").toLowerCase();
    expect(html).toContain('href="/src/resources/logos/chentako.svg"');
    expect(html).toContain(canvasMid);
    const onboarding = readFileSync(resolve("onboarding.html"), "utf8").toLowerCase();
    expect(onboarding).toContain('href="/src/resources/logos/chentako.svg"');
    expect(onboarding).toContain(canvasMid);
  });

  it("主题契约白名单覆盖可主题化的合成令牌（paper-shadow）", () => {
    expect(SUPPORTED_THEME_TOKENS.has("--paper-shadow")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--paper-shadow-raised")).toBe(true);
  });
});
