"use strict";

import { beforeEach, describe, expect, it } from "vitest";
import {
  __surfaceAppearanceTest,
  applySurfaceAppearance,
  readSurfaceAppearance,
  removeThemeAppearance,
  replaceThemeAppearance,
  setSurfaceContrast,
  setTransparentMode,
  writeSurfaceAppearance
} from "../src/modules/appearance/surface.js";
import { STORAGE_KEYS } from "../src/contracts/constants.js";

describe("纯色表面外观", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.dataset.theme = "studio";
    document.documentElement.dataset.scheme = "light";
    document.documentElement.style.cssText = "";
    __surfaceAppearanceTest.reset();
  });

  it("按主题与明暗模式保存对比度和透景偏好", () => {
    writeSurfaceAppearance("studio", "light", { contrast: 76, transparent: true });
    writeSurfaceAppearance("studio", "dark", { contrast: 44 });
    expect(readSurfaceAppearance("studio", "light")).toEqual({ contrast: 76, transparent: true });
    expect(readSurfaceAppearance("studio", "dark")).toEqual({ contrast: 44, transparent: false });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.themeAppearance)).themes.studio.light.contrast).toBe(76);
  });

  it("对比度越界会夹紧，非法值回到 60", () => {
    expect(writeSurfaceAppearance("studio", "light", { contrast: 130 }).contrast).toBe(100);
    expect(writeSurfaceAppearance("studio", "light", { contrast: -5 }).contrast).toBe(0);
    expect(writeSurfaceAppearance("studio", "light", { contrast: "bad" }).contrast).toBe(60);
  });

  it("实体模式不使用模糊，透景模式的材质强度由对比度派生", () => {
    applySurfaceAppearance();
    expect(document.documentElement.classList.contains("transparency-mode")).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--appearance-backdrop-filter")).toBe("none");

    setTransparentMode(true);
    const low = document.documentElement.style.getPropertyValue("--appearance-panel-bg");
    setSurfaceContrast(100);
    const high = document.documentElement.style.getPropertyValue("--appearance-panel-bg");
    expect(document.documentElement.classList.contains("transparency-mode")).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--appearance-backdrop-filter")).toContain("blur(24.0px)");
    expect(low).not.toBe(high);
  });

  it("整包替换与主题删除不会触碰旧背景存储", () => {
    localStorage.setItem(STORAGE_KEYS.themeBackgrounds, "legacy-background-data");
    replaceThemeAppearance("studio", {
      light: { contrast: 70, transparent: true },
      dark: { contrast: 50, transparent: false }
    });
    expect(readSurfaceAppearance("studio", "dark").contrast).toBe(50);
    expect(removeThemeAppearance("studio")).toBe(true);
    expect(readSurfaceAppearance("studio", "light")).toEqual({ contrast: 60, transparent: false });
    expect(localStorage.getItem(STORAGE_KEYS.themeBackgrounds)).toBe("legacy-background-data");
  });
});
