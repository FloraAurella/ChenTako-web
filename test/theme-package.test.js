"use strict";

import { describe, expect, it } from "vitest";
import {
  createThemePackage,
  parseThemePackage,
  serializeThemePackage,
  THEME_PACKAGE_EXTENSION,
  THEME_PACKAGE_KIND,
  THEME_PACKAGE_VERSION,
  themePackageFilename
} from "../src/modules/appearance/domain/package.js";

const theme = {
  id: "studio",
  label: "Studio",
  note: "JSON 主题",
  preview: { canvas: "#faf9f2", paper: "#ffffff", accent: "#f4d35e", line: "#a8d94e" },
  captions: { light: "", dark: "" },
  tokens: { light: { "--accent": "#f4d35e" }, dark: { "--accent": "#e8c65a" } },
  fixedScheme: ""
};

describe("JSON 主题文件", () => {
  it("新品牌导出仍可导入旧品牌主题包", () => {
    const payload = createThemePackage(theme);
    expect(payload.kind).toBe("ai-chatbox-theme-package");
    expect(parseThemePackage(JSON.stringify({ ...payload, kind: "clawbox-theme-package" })).definition.id).toBe("studio");
  });
  it("以可读 JSON 往返主题、对比度与透景偏好", () => {
    const payload = createThemePackage(theme, {
      light: { contrast: 72, transparent: true },
      dark: { contrast: 48, transparent: false }
    });
    const text = serializeThemePackage(payload);
    expect(text.trimStart().startsWith("{")).toBe(true);
    expect(JSON.parse(text)).toMatchObject({
      kind: THEME_PACKAGE_KIND,
      version: THEME_PACKAGE_VERSION
    });
    const decoded = parseThemePackage(text);
    expect(decoded.definition).toMatchObject({ id: "studio", label: "Studio" });
    expect(decoded.appearance).toEqual({
      light: { contrast: 72, transparent: true },
      dark: { contrast: 48, transparent: false }
    });
  });

  it("扩展名和下载文件名只使用 json", () => {
    expect(THEME_PACKAGE_EXTENSION).toBe("json");
    expect(themePackageFilename(theme)).toBe("ChenTako-studio.json");
  });

  it("不导出主题动效，也不保留背景图片字段", () => {
    const payload = createThemePackage({ ...theme, motion: "return { tick() {} }" }, {
      light: { contrast: 60, transparent: true, image: "data:image/png;base64,AAAA", blur: 99 }
    });
    const text = serializeThemePackage(payload);
    expect(text).not.toContain("motion");
    expect(text).not.toContain("data:image");
    expect(text).not.toContain('"blur"');
  });

  it("拒绝带附件结构的新主题包和旧便携包 JSON 载荷", () => {
    const payload = createThemePackage(theme, null);
    expect(() => parseThemePackage(JSON.stringify({ ...payload, files: [] })))
      .toThrow("不支持自定义背景或附件");
    expect(() => parseThemePackage(JSON.stringify({ kind: "clawbox-portable-theme", version: 3 })))
      .toThrow(".peratheme 主题包已弃用");
  });

  it("对比度归一化到 0–100，缺省为 60", () => {
    const decoded = parseThemePackage(serializeThemePackage(createThemePackage(theme, {
      light: { contrast: 999 },
      dark: { contrast: -20 }
    })));
    expect(decoded.appearance.light.contrast).toBe(100);
    expect(decoded.appearance.dark.contrast).toBe(0);
    expect(createThemePackage(theme, null).appearance.light.contrast).toBe(60);
  });

  it("继续兼容原有 clawbox-theme JSON 配置", () => {
    const decoded = parseThemePackage(JSON.stringify({
      format: "clawbox-theme",
      version: 1,
      id: "legacy",
      name: "旧 JSON",
      scheme: "light",
      colors: { action: { base: "#336699" } }
    }));
    expect(decoded.source).toBe("legacy-json");
    expect(decoded.definition.id).toBe("legacy");
    expect(decoded.appearance.light).toEqual({ contrast: 60, transparent: false });
  });

  it("拒绝损坏、空白和版本不受支持的 JSON", () => {
    expect(() => parseThemePackage("not json")).toThrow("JSON 解析失败");
    expect(() => parseThemePackage("   ")).toThrow("主题 JSON 为空");
    expect(() => parseThemePackage(JSON.stringify({
      ...createThemePackage(theme, null),
      version: 2
    }))).toThrow("版本不受支持");
  });
});
