"use strict";

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import {
  parseJsonThemeFile,
  buildUserThemeDefinition,
  saveUserThemeFile,
  listUserThemeFiles,
  removeUserThemeFile,
  restoreUserThemes,
  MAX_USER_THEMES
} from "../src/modules/appearance/domain/user-theme.js";
import { getTheme, unregisterTheme, registerTheme } from "../src/modules/appearance/domain/registry.js";
import { defineTheme } from "../src/modules/appearance/domain/contract.js";
import everforestDefinition from "../src/modules/appearance/domain/custom/everforest.theme.js";
import { parseThemePackage } from "../src/modules/appearance/domain/package.js";

const FULL_THEME = {
  format: "clawbox-theme",
  version: 1,
  id: "seaside",
  name: "海盐气泡",
  description: "海边清晨的蓝白配色",
  scheme: "light",
  colors: {
    canvas: { top: "#f4f8f9", middle: "#eef4f5", bottom: "#e4eef0" },
    surface: { content: "#ffffff", elevated: "#ffffff", subtle: "#e6f0f2", raised: "#ffffff" },
    text: { primary: "#24343A", secondary: "#56707a", tertiary: "#8aa0a8" },
    identity: { pear: "#6fc3d6", pearHover: "#5db0c4", onPear: "#10303a" },
    action: {
      base: "#ffb35c", hover: "#ffc077", pressed: "#f0a04b",
      soft: "#fdeeda", onAccent: "#3a2a14", focusRing: "#2f8ba3"
    },
    context: { base: "#2f7d96", soft: "#dceff3", selectedFill: "#d5eaf0" },
    separator: { regular: "#24343a", strong: "#24343a" },
    status: { destructive: "#c25b4d", warning: "#b07e1e", success: "#3d8a63" },
    shadow: { regular: "#1d333c", strong: "#1d333c" },
    glass: { regular: "#f4f8f9", strong: "#ffffff" },
    ambient: { glow: "#6fc3d6", vignette: "#24343a" },
    code: { background: "#ecf3f4", border: "#d3e2e5", inlineBackground: "#dcebee", inlineText: "#24343a" },
    syntax: {
      plain: "#2c3d44", comment: "#6c8189", keyword: "#c25b4d", string: "#3d8a63",
      constant: "#2f6f96", entity: "#9a5c74", variable: "#9a6a2f", list: "#7a6e2f",
      quote: "#2f7d96", invalid: "#b3442e"
    },
    effort: {
      panel: "#ffffff", ink: "#24343a", track: "#d5eaf0", accent: "#5db0c4",
      accentSoft: "#d5eaf0", thumb: "#5db0c4", dot: "#2f7d96"
    }
  },
  iridescence: {
    colors: ["#7ec8d8", "#a8d94e", "#ffb35c", "#e88a7c", "#b8a5d9"],
    idleOpacity: 0.18,
    activeOpacity: 0.36
  }
};

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); }
  };
}

describe("JSON 主题文件：解析与转换", () => {
  it("完整文件通过校验并转换为可注册定义", () => {
    const { errors, definition } = buildUserThemeDefinition(FULL_THEME);
    expect(errors).toEqual([]);
    expect(definition.id).toBe("seaside");
    expect(definition.label).toBe("海盐气泡");
    expect(definition.note).toBe("海边清晨的蓝白配色");
    expect(definition.fixedScheme).toBe("light");
    expect(() => defineTheme(definition)).not.toThrow();

    const light = definition.tokens.light;
    expect(light["--canvas-mid"]).toBe("#eef4f5");
    expect(light["--accent"]).toBe("#ffb35c");
    // 大写十六进制统一转小写
    expect(light["--label"]).toBe("#24343a");
    // 预览四色从色板派生
    expect(definition.preview).toEqual({
      canvas: "#eef4f5", paper: "#ffffff", accent: "#ffb35c", line: "#6fc3d6"
    });
  });

  it("仍可读取改名前的 JSON 主题格式", () => {
    const { errors, definition } = buildUserThemeDefinition({
      ...FULL_THEME,
      format: "tribblebook-theme"
    });
    expect(errors).toEqual([]);
    expect(definition.id).toBe("seaside");
  });

  it("半透明令牌按浅/深两套透明度转成 rgba", () => {
    const { definition } = buildUserThemeDefinition(FULL_THEME);
    expect(definition.tokens.light["--separator"]).toBe("rgba(36, 52, 58, 0.14)");
    expect(definition.tokens.dark["--separator"]).toBe("rgba(36, 52, 58, 0.12)");
    expect(definition.tokens.light["--glass-strong-bg"]).toBe("rgba(255, 255, 255, 0.94)");
    expect(definition.tokens.dark["--shadow-ink"]).toBe("rgba(29, 51, 60, 0.42)");
  });

  it("assistant 模块映射 AI 回复气泡令牌", () => {
    const { errors, definition } = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 1,
      name: "气泡测试",
      colors: { assistant: { background: "#ffffff", border: "#24343a" } }
    });
    expect(errors).toEqual([]);
    expect(definition.tokens.light["--assistant-bubble-bg"]).toBe("rgba(255, 255, 255, 0.72)");
    expect(definition.tokens.dark["--assistant-bubble-bg"]).toBe("rgba(255, 255, 255, 0.66)");
    expect(definition.tokens.light["--assistant-bubble-border"]).toBe("rgba(36, 52, 58, 0.32)");
    expect(definition.tokens.dark["--assistant-bubble-border"]).toBe("rgba(36, 52, 58, 0.28)");
  });

  it("user 模块映射用户消息气泡令牌（半透明自动套透明度，文字不变）", () => {
    const { errors, definition } = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 1,
      name: "用户气泡测试",
      colors: { user: { background: "#6fc3d6", border: "#10303a", text: "#10303a" } }
    });
    expect(errors).toEqual([]);
    expect(definition.tokens.light["--user-bubble-bg"]).toBe("rgba(111, 195, 214, 0.72)");
    expect(definition.tokens.dark["--user-bubble-bg"]).toBe("rgba(111, 195, 214, 0.66)");
    expect(definition.tokens.light["--user-bubble-border"]).toBe("rgba(16, 48, 58, 0.32)");
    expect(definition.tokens.dark["--user-bubble-border"]).toBe("rgba(16, 48, 58, 0.28)");
    expect(definition.tokens.light["--on-user-bubble"]).toBe("#10303a");
    expect(definition.tokens.dark["--on-user-bubble"]).toBe("#10303a");

    // 未设 user 模块时不产生覆盖，气泡回落样式表基线（跟随 identity.pear）
    const omitted = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 1,
      name: "回落测试",
      colors: { identity: { pear: "#6fc3d6" } }
    });
    expect(omitted.errors).toEqual([]);
    expect(omitted.definition.tokens.light["--user-bubble-bg"]).toBeUndefined();
  });

  it("identity 模块可单独钉住品牌标颜色（logo / onLogo），未写时回落身份色", () => {
    const { errors, definition } = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 1,
      name: "品牌标测试",
      colors: { identity: { pear: "#6fc3d6", logo: "#7fc9da", onLogo: "#0c2a33" } }
    });
    expect(errors).toEqual([]);
    for (const scheme of ["light", "dark"]) {
      expect(definition.tokens[scheme]["--brand-logo"]).toBe("#7fc9da");
      expect(definition.tokens[scheme]["--on-brand-logo"]).toBe("#0c2a33");
    }

    const omitted = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 1,
      name: "品牌标回落测试",
      colors: { identity: { pear: "#6fc3d6" } }
    });
    expect(omitted.errors).toEqual([]);
    expect(omitted.definition.tokens.light["--brand-logo"]).toBeUndefined();
  });

  it("buttons 模块映射三类按钮令牌（主行动 / 发送 / 图标）", () => {
    const { errors, definition } = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 1,
      name: "按钮测试",
      colors: {
        buttons: {
          primary: "#2f7d96", primaryHover: "#3a8ca6", primaryPressed: "#296f87", onPrimary: "#f4f8f9",
          send: "#ff9d4d", sendHover: "#ffab66", sendPressed: "#f08c3c", onSend: "#3a2a14",
          icon: "#56707a", iconHover: "#2f7d96", iconHoverBg: "#dceff3"
        }
      }
    });
    expect(errors).toEqual([]);
    for (const scheme of ["light", "dark"]) {
      const tokens = definition.tokens[scheme];
      expect(tokens["--btn-primary"]).toBe("#2f7d96");
      expect(tokens["--btn-primary-hover"]).toBe("#3a8ca6");
      expect(tokens["--btn-primary-pressed"]).toBe("#296f87");
      expect(tokens["--on-btn-primary"]).toBe("#f4f8f9");
      expect(tokens["--send-btn"]).toBe("#ff9d4d");
      expect(tokens["--send-btn-hover"]).toBe("#ffab66");
      expect(tokens["--send-btn-pressed"]).toBe("#f08c3c");
      expect(tokens["--on-send-btn"]).toBe("#3a2a14");
      expect(tokens["--icon-btn-ink"]).toBe("#56707a");
      expect(tokens["--icon-btn-ink-hover"]).toBe("#2f7d96");
      expect(tokens["--icon-btn-hover-bg"]).toBe("#dceff3");
    }
  });

  it("buttons 模块字段可部分省略，未写的回落样式表基线", () => {
    const { errors, definition } = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 1,
      name: "按钮省略测试",
      colors: { buttons: { send: "#ff9d4d", icon: "#56707a" } }
    });
    expect(errors).toEqual([]);
    expect(definition.tokens.light["--send-btn"]).toBe("#ff9d4d");
    expect(definition.tokens.light["--icon-btn-ink"]).toBe("#56707a");
    expect(definition.tokens.light["--btn-primary"]).toBeUndefined();
    expect(definition.tokens.light["--on-send-btn"]).toBeUndefined();
  });

  it("effects 与 groups 模块接管组件中原本散落的效果色", () => {
    const { errors, definition } = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 1,
      name: "效果色测试",
      colors: {
        effects: {
          highlight: "#fefefe",
          highlightStrong: "#ffffff",
          shadow: "#172018",
          overlay: "#12140f",
          overlayText: "#f0f2e8",
          overlayControl: "#fafcf4",
          overlayShadow: "#000000",
          imageFill: "#ffffff"
        },
        groups: { one: "#3e8a5e", five: "#9b7bd1" }
      }
    });
    expect(errors).toEqual([]);
    expect(definition.tokens.light["--control-shadow"]).toBe("#172018");
    expect(definition.tokens.dark["--overlay-text"]).toBe("#f0f2e8");
    expect(definition.tokens.light["--group-color-5"]).toBe("#9b7bd1");
  });

  it("虹彩令牌由色环数组生成 conic-gradient 与透明度", () => {
    const { definition } = buildUserThemeDefinition(FULL_THEME);
    expect(definition.tokens.light["--rainbow"])
      .toBe("conic-gradient(from 210deg, #7ec8d8, #a8d94e, #ffb35c, #e88a7c, #b8a5d9, #7ec8d8)");
    expect(definition.tokens.light["--rainbow-alpha"]).toBe("0.18");
    expect(definition.tokens.dark["--rainbow-alpha-active"]).toBe("0.36");
  });

  it("typefaces：白名单栈写入定义与明暗字体令牌（mono 覆盖代码字体）", () => {
    const { errors, definition } = buildUserThemeDefinition({
      ...FULL_THEME,
      typefaces: { body: "rounded", display: "songti", mono: "mono" }
    });
    expect(errors).toEqual([]);
    expect(definition.typefaces).toEqual({ body: "rounded", display: "songti", mono: "mono" });
    for (const scheme of ["light", "dark"]) {
      expect(definition.tokens[scheme]["--font-body"]).toContain("Yuanti SC");
      expect(definition.tokens[scheme]["--font-display"]).toContain("Songti SC");
      expect(definition.tokens[scheme]["--font-mono"]).toContain("SF Mono");
      expect(definition.tokens[scheme]["--font-code"]).toBe(definition.tokens[scheme]["--font-mono"]);
    }
  });

  it("typefaces：非法角色或字体栈被拒绝", () => {
    const badRole = buildUserThemeDefinition({ ...FULL_THEME, typefaces: { title: "sans" } });
    expect(badRole.errors.join("；")).toMatch(/不支持的字体角色/);
    const badStack = buildUserThemeDefinition({ ...FULL_THEME, typefaces: { body: "comic-sans-ms" } });
    expect(badStack.errors.join("；")).toMatch(/无效的字体栈/);
  });

  it("只覆盖部分模块也可用，未覆盖令牌回落样式表基线", () => {
    const { errors, definition } = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 1,
      name: "Mini",
      colors: { action: { base: "#715b91" } }
    });
    expect(errors).toEqual([]);
    // 颜色只有 action.base 一项；字体令牌始终写入（typefaces 缺省补默认栈）
    expect(Object.keys(definition.tokens.light)).toEqual([
      "--accent", "--font-body", "--font-display", "--font-mono", "--font-code"
    ]);
    expect(definition.fixedScheme).toBe("");
    expect(definition.preview.accent).toBe("#715b91");
  });

  it("缺 id 时从名字派生：拉丁名 slug、非拉丁名稳定哈希", () => {
    const latin = buildUserThemeDefinition({
      format: "clawbox-theme", version: 1, name: "Seaside Breeze", colors: { canvas: { middle: "#ffffff" } }
    });
    expect(latin.definition.id).toBe("seaside-breeze");

    const cjk = buildUserThemeDefinition({
      format: "clawbox-theme", version: 1, name: "海盐气泡", colors: { canvas: { middle: "#ffffff" } }
    });
    expect(cjk.definition.id).toMatch(/^user-/);
    const again = buildUserThemeDefinition({
      format: "clawbox-theme", version: 1, name: "海盐气泡", colors: { canvas: { middle: "#ffffff" } }
    });
    expect(again.definition.id).toBe(cjk.definition.id);
  });

  it("稳定 ID：同文件重复导入命中同 ID（更新），改名派生变化，带 ID 沿用不改", () => {
    const withDescription = {
      format: "clawbox-theme", version: 1, name: "海盐气泡", description: "第一版",
      colors: { canvas: { middle: "#ffffff" } }
    };
    const v1 = buildUserThemeDefinition(withDescription).definition;
    const v2 = buildUserThemeDefinition({ ...withDescription, description: "第二版" }).definition;
    expect(v2.id).toBe(v1.id);

    const renamed = buildUserThemeDefinition({
      format: "clawbox-theme", version: 1, name: "海盐气泡 2", colors: { canvas: { middle: "#ffffff" } }
    }).definition;
    expect(renamed.id).not.toBe(v1.id);

    const withId = buildUserThemeDefinition({ ...withDescription, id: "my-fixed-id" }).definition;
    const withIdAgain = buildUserThemeDefinition({ ...withDescription, id: "my-fixed-id" }).definition;
    expect(withId.id).toBe("my-fixed-id");
    expect(withIdAgain.id).toBe("my-fixed-id");
  });

  it("v2 双态格式：colors.light 与 colors.dark 分别定义明暗令牌", () => {
    const { errors, definition } = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 2,
      name: "双态测试",
      colors: {
        light: {
          action: { base: "#ff0000" },
          canvas: { middle: "#ffffff" }
        },
        dark: {
          action: { base: "#ff6666" },
          canvas: { middle: "#1a1a1a" }
        }
      }
    });
    expect(errors).toEqual([]);
    expect(definition.fixedScheme).toBe(""); // v2 双态主题不锁死明暗
    expect(definition.tokens.light["--accent"]).toBe("#ff0000");
    expect(definition.tokens.dark["--accent"]).toBe("#ff6666");
    expect(definition.tokens.light["--canvas-mid"]).toBe("#ffffff");
    expect(definition.tokens.dark["--canvas-mid"]).toBe("#1a1a1a");
  });

  it("v2 双态格式：只提供 light 或 dark 其中之一时，缺失档位回落基线", () => {
    const { errors: lightOnlyErrors, definition: lightOnly } = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 2,
      name: "仅明色",
      colors: {
        light: { action: { base: "#00ff00" } }
      }
    });
    expect(lightOnlyErrors).toEqual([]);
    expect(lightOnly.tokens.light["--accent"]).toBe("#00ff00");
    expect(lightOnly.tokens.dark["--accent"]).toBeDefined(); // 回落基线
    expect(lightOnly.tokens.dark["--canvas-mid"]).toBeDefined();

    const { errors: darkOnlyErrors, definition: darkOnly } = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 2,
      name: "仅暗色",
      colors: {
        dark: { action: { base: "#0000ff" } }
      }
    });
    expect(darkOnlyErrors).toEqual([]);
    expect(darkOnly.tokens.dark["--accent"]).toBe("#0000ff");
    expect(darkOnly.tokens.light["--accent"]).toBeDefined(); // 回落基线
    expect(darkOnly.tokens.light["--canvas-mid"]).toBeDefined();
  });

  it("v2 格式校验：不应包含 scheme 字段", () => {
    const { errors } = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 2,
      name: "错误的 scheme",
      scheme: "light",
      colors: {
        light: { action: { base: "#ff0000" } }
      }
    });
    expect(errors.some(e => e.includes("scheme"))).toBe(true);
  });

  it("v1 与 v2 格式互不兼容：v1 用 light/dark 键报错，v2 缺 light/dark 报错", () => {
    const v1WithDualKeys = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 1,
      name: "v1 错误双态",
      colors: {
        light: { action: { base: "#ff0000" } }
      }
    });
    expect(v1WithDualKeys.errors.some(e => e.includes("version: 2"))).toBe(true);

    const v2WithSingleColors = buildUserThemeDefinition({
      format: "clawbox-theme",
      version: 2,
      name: "v2 错误单态",
      colors: {
        action: { base: "#ff0000" }
      }
    });
    expect(v2WithSingleColors.errors.some(e => e.includes("至少需要提供一个"))).toBe(true);
  });

  it("文本解析：非法 JSON 直接报错", () => {
    const { errors, definition } = parseJsonThemeFile("{ not json");
    expect(definition).toBeNull();
    expect(errors.join("")).toMatch(/JSON/);
  });

  it("仓库示例文件 examples/everforest-clawbox-theme-v1.json 可直接导入", () => {
    const examplePath = resolvePath(process.cwd(), "src", "resources", "themes", "everforest-clawbox-theme-v1.json");
    const { definition } = parseThemePackage(readFileSync(examplePath, "utf8"));
    expect(definition.id).toBe("everforest");
    expect(definition.label).toBe("Everforest");
    expect(definition.typefaces).toEqual({ body: "serif", display: "serif", mono: "mono" });
  });
});

describe("JSON 主题文件：校验错误", () => {
  const base = { format: "clawbox-theme", version: 1, name: "T", colors: { action: { base: "#715b91" } } };

  function errorsOf(override) {
    return buildUserThemeDefinition({ ...base, ...override }).errors.join("；");
  }

  it("format / version 不符被拒绝", () => {
    expect(errorsOf({ format: "other" })).toMatch(/format/);
    expect(errorsOf({ version: 2 })).toMatch(/version/);
  });

  it("缺失或超长的名字 / 简介被拒绝", () => {
    expect(buildUserThemeDefinition({ ...base, name: "" }).errors.join("")).toMatch(/name/);
    expect(errorsOf({ name: "x".repeat(41) })).toMatch(/40/);
    expect(errorsOf({ description: "y".repeat(121) })).toMatch(/120/);
  });

  it("颜色必须是六位 #RRGGBB 十六进制", () => {
    expect(errorsOf({ colors: { action: { base: "#fff" } } })).toMatch(/#RRGGBB/);
    expect(errorsOf({ colors: { action: { base: "red" } } })).toMatch(/#RRGGBB/);
    expect(errorsOf({ colors: { action: { base: "#GGGGGG" } } })).toMatch(/#RRGGBB/);
    expect(errorsOf({ colors: {} })).toMatch(/至少/);
    expect(errorsOf({ colors: null })).toMatch(/colors/);
  });

  it("未知模块与未知字段被拒绝并列出可选值", () => {
    expect(errorsOf({ colors: { nosuch: { a: "#ffffff" } } })).toMatch(/未知模块/);
    expect(errorsOf({ colors: { action: { nosuch: "#ffffff" } } })).toMatch(/不支持字段/);
  });

  it("内置主题 ID 允许使用（同 ID 文件 = 更新内置主题），非法 ID 与 scheme 被拒绝", () => {
    expect(errorsOf({ id: "juicy-pear" })).toBe("");
    expect(errorsOf({ id: "night-orchard" })).toBe("");
    expect(errorsOf({ id: "1bad" })).toMatch(/id/);
    expect(errorsOf({ scheme: "sepia" })).toMatch(/scheme/);
  });

  it("虹彩配置：颜色数量与透明度范围受检", () => {
    expect(errorsOf({ iridescence: { colors: ["#ffffff"] } })).toMatch(/2–12/);
    expect(errorsOf({ iridescence: { colors: ["#ffffff", "#00000z"] } })).toMatch(/#RRGGBB/);
    expect(errorsOf({ iridescence: { colors: ["#ffffff", "#000000"], idleOpacity: 2 } })).toMatch(/0–1/);
  });
});

describe("用户主题本机持久化", () => {
  it("保存 / 列表 / 删除往返，同 ID 覆盖", () => {
    const storage = memoryStorage();
    saveUserThemeFile({ id: "seaside", raw: FULL_THEME }, storage);
    saveUserThemeFile({ id: "seaside", raw: { ...FULL_THEME, name: "海盐气泡 2" } }, storage);
    saveUserThemeFile({ id: "another", raw: { ...baseTheme("another") } }, storage);
    const listed = listUserThemeFiles(storage);
    expect(listed).toHaveLength(2);
    expect(listed.find((entry) => entry.id === "seaside").raw.name).toBe("海盐气泡 2");

    expect(removeUserThemeFile("seaside", storage)).toBe(true);
    expect(listUserThemeFiles(storage).map((entry) => entry.id)).toEqual(["another"]);
    expect(removeUserThemeFile("seaside", storage)).toBe(false);
  });

  it("超过上限拒绝保存", () => {
    const storage = memoryStorage();
    for (let i = 0; i < MAX_USER_THEMES; i += 1) {
      saveUserThemeFile({ id: `theme-${i}`, raw: baseTheme(`theme-${i}`) }, storage);
    }
    expect(() => saveUserThemeFile({ id: "overflow", raw: baseTheme("overflow") }, storage))
      .toThrow(/最多保存/);
  });

  it("启动恢复注册有效条目，损坏条目被跳过", () => {
    const storage = memoryStorage();
    saveUserThemeFile({ id: "seaside", raw: FULL_THEME }, storage);
    saveUserThemeFile({ id: "broken", raw: { format: "wrong", version: 9, name: "" } }, storage);
    const restoreErrors = [];
    const originalError = console.error;
    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      if (typeof args[0] === "string" && args[0].startsWith("[Clawbox Theme] 无法恢复自定义主题 broken：")) {
        restoreErrors.push(args[0]);
      } else {
        originalError(...args);
      }
    });
    let restored;
    try {
      restored = restoreUserThemes(storage);
    } finally {
      errorSpy.mockRestore();
    }
    expect(restored).toEqual(["seaside"]);
    expect(getTheme("seaside").user).toBe(true);
    expect(getTheme("seaside").tokens.light["--accent"]).toBe("#ffb35c");
    expect(getTheme("broken")).toBeNull();
    expect(restoreErrors).toHaveLength(1);
  });

  it("注销：内置主题受保护，用户主题可移除", () => {
    registerTheme(everforestDefinition, { builtin: true, sourceCustom: true, replace: true });
    expect(() => unregisterTheme("everforest")).toThrow(/内置主题/);
    // 保存并恢复普通用户主题。
    const storage = memoryStorage();
    saveUserThemeFile({ id: "seaside", raw: FULL_THEME }, storage);
    restoreUserThemes(storage);
    expect(unregisterTheme("seaside", { force: true })).toBe(true);
    expect(getTheme("seaside")).toBeNull();
  });
});

function baseTheme(id) {
  return {
    format: "clawbox-theme",
    version: 1,
    id,
    name: id,
    colors: { canvas: { middle: "#ffffff" } }
  };
}
