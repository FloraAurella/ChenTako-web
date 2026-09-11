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

describe("品牌 Logo 剪影", () => {
  it("默认使用 Tribble 与打开的书", () => {
    expect(DEFAULT_LOGO_SHAPE).toBe("tribble-book");
    expect(isValidLogoShape(DEFAULT_LOGO_SHAPE)).toBe(true);
    expect(LOGO_SHAPES[DEFAULT_LOGO_SHAPE]).toBeDefined();
  });

  it("默认品牌标只渲染一种颜色", () => {
    const paths = logoSvgPaths(DEFAULT_LOGO_SHAPE, "#ffffff", "#ffb35c");
    expect(paths).toContain("fill='#ffffff'");
    expect(paths).not.toContain("#ffb35c");
    expect(paths.match(/<path/g)).toHaveLength(1);
    expect(paths).toContain("fill-rule='evenodd'");

    const svg = renderLogoSvg(DEFAULT_LOGO_SHAPE, "#6fc3d6");
    expect(svg).toContain("viewBox='0 0 24 24'");
    expect(svg).toContain(LOGO_SHAPES[DEFAULT_LOGO_SHAPE].body);
    expect(svg.match(/fill='#6fc3d6'/g)).toHaveLength(1);
  });

  it("默认剪影保持无曲线的整数像素网格", () => {
    const { body } = LOGO_SHAPES[DEFAULT_LOGO_SHAPE];
    expect(body).not.toMatch(/[CcQqSsAa]/);
    expect(body).not.toMatch(/\d+\.\d+/);
  });

  it.each(["index.html", "onboarding.html"])("%s 首帧 favicon 与默认剪影一致", (file) => {
    const html = readFileSync(resolve(file), "utf8");
    expect(html).toContain(LOGO_SHAPES[DEFAULT_LOGO_SHAPE].body);
    expect(html.match(/%3Cpath/gi)).toHaveLength(1);
    expect(html).toContain("fill-rule='evenodd'");
  });

  it("未知形状回退到默认品牌标", () => {
    expect(logoSvgPaths("missing")).toContain(LOGO_SHAPES[DEFAULT_LOGO_SHAPE].body);
  });
});
