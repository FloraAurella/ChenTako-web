"use strict";

import { describe, it, expect, beforeEach } from "vitest";
import {
  defineTheme,
  validateThemeDefinition,
  isValidThemeId,
  SUPPORTED_THEME_TOKENS,
  THEME_API_VERSION
} from "../src/modules/appearance/domain/contract.js";
import { registerTheme, listThemes, getTheme, unregisterTheme, SOURCE_THEME_ORDER } from "../src/modules/appearance/domain/registry.js";
import { migrateLegacyThemePrefs } from "../src/modules/appearance/controller.js";
import everforestDefinition from "../src/modules/appearance/domain/custom/everforest.theme.js";
import { LIGHT_TOKENS, DARK_TOKENS } from "../src/modules/appearance/domain/base-themes.js";

const VALID_THEME = {
  id: "studio",
  label: "夜航工作室",
  baseTheme: "paper-light",
  preview: { canvas: "#eeeaf2", paper: "#fffaff", accent: "#715b91", line: "#b9aec7" },
  tokens: {
    light: { "--accent": "#715b91" },
    dark: { "--accent": "#c7afe8" }
  }
};

function parseCssColor(value) {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    return {
      rgb: [0, 2, 4].map((offset) => parseInt(hex[1].slice(offset, offset + 2), 16)),
      alpha: 1
    };
  }
  const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(value);
  if (rgba) {
    return {
      rgb: rgba.slice(1, 4).map(Number),
      alpha: Number(rgba[4])
    };
  }
  throw new Error(`测试不支持解析颜色：${value}`);
}

function composite(foreground, background) {
  const foregroundColor = parseCssColor(foreground);
  const backgroundColor = parseCssColor(background);
  return foregroundColor.rgb.map((channel, index) => (
    channel * foregroundColor.alpha + backgroundColor.rgb[index] * (1 - foregroundColor.alpha)
  ));
}

function relativeLuminance(rgb) {
  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground, background, canvas = background) {
  const foregroundRgb = composite(foreground, canvas);
  const backgroundRgb = composite(background, canvas);
  const foregroundLuminance = relativeLuminance(foregroundRgb);
  const backgroundLuminance = relativeLuminance(backgroundRgb);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

describe("主题契约", () => {
  it("版本为 1，白名单包含双主题色板、效果与代码令牌", () => {
    expect(THEME_API_VERSION).toBe(1);
    expect(SUPPORTED_THEME_TOKENS.has("--accent")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--pear")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--on-pear")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--glass-bg")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--rainbow-alpha")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--grain-opacity")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--code-bg")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--syntax-keyword")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--effort-accent")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--effort-accent-2")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--effort-thumb")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--assistant-bubble-bg")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--assistant-bubble-border")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--overlay-scrim")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--image-fill")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--group-color-5")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--btn-primary")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--on-btn-primary")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--send-btn")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--on-send-btn")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--icon-btn-ink")).toBe(true);
    expect(SUPPORTED_THEME_TOKENS.has("--icon-btn-hover-bg")).toBe(true);
  });

  it("合法定义通过并冻结", () => {
    const theme = defineTheme(VALID_THEME);
    expect(theme.id).toBe("studio");
    expect(Object.isFrozen(theme)).toBe(true);
  });

  it("typefaces：缺省携带默认字体栈，合法值透传", () => {
    expect(defineTheme(VALID_THEME).typefaces).toEqual({ body: "serif", display: "serif", mono: "mono" });
    const styled = defineTheme({ ...VALID_THEME, typefaces: { body: "rounded", display: "songti" } });
    expect(styled.typefaces).toEqual({ body: "rounded", display: "songti", mono: "mono" });
  });

  it("typefaces：非法角色与非法字体栈被拒", () => {
    expect(() => defineTheme({ ...VALID_THEME, typefaces: { title: "sans" } }))
      .toThrow(/不支持的字体角色/);
    expect(() => defineTheme({ ...VALID_THEME, typefaces: { body: "comic-sans-ms" } }))
      .toThrow(/无效的字体栈/);
  });

  it("未知令牌被拒绝", () => {
    const errors = validateThemeDefinition({
      ...VALID_THEME,
      tokens: { light: { "--not-a-token": "#fff" } }
    });
    expect(errors.join("")).toMatch(/未知令牌/);
  });

  it("不安全 CSS 值被拒绝", () => {
    const errors = validateThemeDefinition({
      ...VALID_THEME,
      tokens: { light: { "--accent": "red; } body { display:none" } }
    });
    expect(errors.join("")).toMatch(/不安全/);
    expect(() => defineTheme({
      ...VALID_THEME,
      tokens: { light: { "--accent": "url(javascript:alert(1))" } }
    })).toThrow();
  });

  it("非法 ID / 缺失 preview 被拒绝", () => {
    expect(() => defineTheme({ ...VALID_THEME, id: "BadID" })).toThrow();
    expect(() => defineTheme({ ...VALID_THEME, id: "1starts-with-digit" })).toThrow();
    expect(() => defineTheme({ ...VALID_THEME, preview: { canvas: "#fff" } })).toThrow();
    expect(isValidThemeId("seaside")).toBe(true);
    expect(isValidThemeId("../evil")).toBe(false);
  });
});

describe("主题注册表", () => {
  beforeEach(() => {
    // 开发模式由 custom/*.theme.js 自动注册，测试环境显式补齐唯一源码主题。
    registerTheme(everforestDefinition, { replace: true, sourceCustom: true });
  });

  it("唯一默认主题是 Everforest，旧默认主题已不再注册", () => {
    const themes = listThemes();
    expect(themes.filter((theme) => theme.sourceCustom).map((theme) => theme.id))
      .toEqual(["everforest"]);
    expect(getTheme("embroidered-starlight")).toBeNull();
    expect(getTheme("seaside")).toBeNull();
  });

  it("默认主题与首帧基线的身份色、行动色与虹彩令牌一致", () => {
    const theme = getTheme("everforest");
    const light = theme.tokens.light;
    const dark = theme.tokens.dark;
    expect(light["--pear"]).toBe(LIGHT_TOKENS["--pear"]);
    expect(light["--accent"]).toBe(LIGHT_TOKENS["--accent"]);
    expect(light["--on-pear"]).toBe(LIGHT_TOKENS["--on-pear"]);
    expect(dark["--pear"]).toBe(DARK_TOKENS["--pear"]);
    expect(dark["--accent"]).toBe(DARK_TOKENS["--accent"]);
    expect(dark["--code-bg"]).toBe(DARK_TOKENS["--code-bg"]);
    expect(light["--rainbow-alpha"]).toBe(LIGHT_TOKENS["--rainbow-alpha"]);
    expect(dark["--rainbow-alpha"]).toBe(DARK_TOKENS["--rainbow-alpha"]);
  });

  it("源码主题顺序只包含 Everforest，用户主题排在其后", () => {
    registerTheme(defineTheme(VALID_THEME), { replace: true, user: true });
    expect(SOURCE_THEME_ORDER).toEqual(["everforest"]);
    expect(listThemes().slice(0, 2).map((theme) => theme.id)).toEqual([
      "everforest",
      "studio"
    ]);
  });

  it("Everforest 是独立双态主题，并完整采用主题包字体与配色", () => {
    const theme = getTheme("everforest");
    expect(theme.label).toBe("Everforest");
    expect(theme.fixedScheme).toBe("");
    expect(theme.typefaces).toEqual({ body: "serif", display: "serif", mono: "mono" });
    expect(theme.tokens.light["--canvas-mid"]).toBe("#F7F5EC");
    expect(theme.tokens.light["--pear"]).toBe("#93B259");
    expect(theme.tokens.light["--send-btn"]).toBe("#617D43");
    expect(theme.tokens.light["--effort-accent"]).toBe("#93B259");
    expect(theme.tokens.light["--effort-dot"]).toBe("#98A19B");
    expect(theme.tokens.dark["--canvas-mid"]).toBe("#232A2E");
    expect(theme.tokens.dark["--accent"]).toBe("#A7C080");
    expect(theme.tokens.dark["--focus-ring"]).toBe("#A7C080");
    expect(theme.tokens.dark["--effort-accent"]).toBe("#A7C080");
    expect(theme.motion || "").toBe("");

    const serialized = JSON.stringify({ tokens: theme.tokens }).toLowerCase();
    for (const purple of ["#76188e", "#2a3eca", "#170b1d", "#28142f", "#1f1025", "#687bff"]) {
      expect(serialized).not.toContain(purple);
    }
  });

  it("Everforest 主正文在明暗两态保持可读对比度", () => {
    const theme = getTheme("everforest");
    for (const scheme of ["light", "dark"]) {
      const tokens = theme.tokens[scheme];
      const surface = tokens["--surface-content"];
      expect(contrastRatio(tokens["--label"], surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens["--on-send-btn"], tokens["--send-btn"])).toBeGreaterThanOrEqual(3);
    }
  });

  it("重复注册需 replace", () => {
    registerTheme(defineTheme(VALID_THEME), { replace: true });
    expect(() => registerTheme(defineTheme(VALID_THEME))).toThrow(/已注册/);
    expect(getTheme("studio").tokens.light["--accent"]).toBe("#715b91");
    registerTheme(defineTheme({ ...VALID_THEME, note: "更新" }), { replace: true });
    expect(getTheme("studio").note).toBe("更新");
  });
});

describe("旧主题迁移", () => {
  it("旧固定场景、纸本、海盐与原默认 ID 统一映射到 Everforest", () => {
    expect(migrateLegacyThemePrefs({ legacyThemeFamily: "cream" })).toMatchObject({
      themeId: "everforest", appearanceMode: "light"
    });
    expect(migrateLegacyThemePrefs({ legacyThemeFamily: "sea-night" })).toMatchObject({
      themeId: "everforest", appearanceMode: "dark"
    });
    expect(migrateLegacyThemePrefs({ legacyThemeFamily: "forest" }).themeId).toBe("everforest");
    expect(migrateLegacyThemePrefs({ legacyThemeFamily: "tropical-sticker" }).themeId).toBe("everforest");
    expect(migrateLegacyThemePrefs({ legacyThemeFamily: "whatever-night" }).appearanceMode).toBe("dark");
    expect(migrateLegacyThemePrefs({ themeId: "paper-dark" }).themeId).toBe("everforest");
    expect(migrateLegacyThemePrefs({ themeId: "paper-light" }).themeId).toBe("everforest");
    expect(migrateLegacyThemePrefs({ themeId: "seaside" }).themeId).toBe("everforest");
    expect(migrateLegacyThemePrefs({ themeId: "embroidered-starlight" }).themeId).toBe("everforest");
  });

  it("旧 appearanceMode 语义保留", () => {
    const prefs = migrateLegacyThemePrefs({
      legacyThemeFamily: "sea",
      appearanceMode: "dark"
    });
    expect(prefs.appearanceMode).toBe("dark");
    expect(migrateLegacyThemePrefs({ appearanceMode: "light" }).appearanceMode).toBe("light");
    expect(migrateLegacyThemePrefs({}).appearanceMode).toBe("system");
  });

  it("已是新主题 ID 时不迁移", () => {
    expect(migrateLegacyThemePrefs({ themeId: "everforest", appearanceMode: "dark" }).themeId)
      .toBe("everforest");
  });
});
