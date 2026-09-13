"use strict";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGO_SHAPE,
  LOGO_SHAPES,
  isValidLogoShape,
  logoSvgPaths,
  renderLogoSvg
} from "../src/resources/logos/shapes.js";
import { resources } from "../src/resources/registry.js";

describe("品牌 Logo 剪影", () => {
  it("默认使用对话框与 AI的唯一 SVG 资源", () => {
    expect(DEFAULT_LOGO_SHAPE).toBe("paper-pen");
    expect(isValidLogoShape(DEFAULT_LOGO_SHAPE)).toBe(true);
    expect(LOGO_SHAPES[DEFAULT_LOGO_SHAPE]).toBe(readFileSync(resolve("src/resources/logos/ai-chatbox.svg"), "utf8"));
  });

  it("默认品牌标的对话框与 AI共用一种主题颜色", () => {
    const paths = logoSvgPaths(DEFAULT_LOGO_SHAPE, "#ffffff", "#ffb35c");
    expect(paths).toContain('stroke="#ffffff"');
    expect(paths).toContain('fill="#ffffff"');
    expect(paths).not.toContain("#ffb35c");
    expect(paths.match(/<path/g)).toHaveLength(3);

    const svg = renderLogoSvg(DEFAULT_LOGO_SHAPE, "#6fc3d6");
    expect(svg).toContain("viewBox='0 0 24 24'");
    expect(svg).toContain('stroke="#6fc3d6"');
    expect(svg).toContain('fill="#6fc3d6"');
    expect(svg).not.toContain("currentColor");
  });

  it("规范 SVG 保持 24 视窗、透明背景和小尺寸圆角几何", () => {
    const svg = LOGO_SHAPES[DEFAULT_LOGO_SHAPE];
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('color="#93B259"');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).not.toMatch(/<(?:rect|circle)[^>]+(?:width="24"|r="12")/);
    expect(svg).not.toMatch(/<(?:script|style|foreignObject|image|use|a)\b/i);
  });

  it.each(["index.html", "onboarding.html"])("%s 首帧 favicon 引用唯一 SVG", (file) => {
    const html = readFileSync(resolve(file), "utf8");
    expect(html).toContain('href="/src/resources/logos/ai-chatbox.svg"');
    expect(html).not.toContain("data:image/svg+xml");
  });

  it("未知形状回退到默认品牌标", () => {
    expect(logoSvgPaths("missing")).toBe(logoSvgPaths(DEFAULT_LOGO_SHAPE));
  });

  it("拒绝可执行、外链 SVG 与注入颜色", () => {
    const dispose = resources.register({
      id: "logo/unsafe-test",
      owner: "logo-shapes-test",
      layer: "module",
      value: '<svg viewBox="0 0 24 24"><path style="fill:url(https://example.test/a.svg)" d="M0 0h1v1Z"/></svg>'
    });
    try {
      expect(() => logoSvgPaths("unsafe-test")).toThrow("Unsafe logo resource");
      const markup = logoSvgPaths(DEFAULT_LOGO_SHAPE, '#fff" onload="alert(1)');
      expect(markup).toContain("currentColor");
      expect(markup).not.toContain("onload");
    } finally {
      dispose();
    }
  });
});
