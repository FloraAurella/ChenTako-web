"use strict";

/**
 * ChenTako 随附的唯一默认主题：Tako Festival。
 * 主题定义直接来自可导入的 JSON 主题包，避免运行时默认值与分发文件漂移。
 */

import { defineTheme } from "../contract.js";
import { defaultThemePackage } from "../../../../resources/themes/default.js";
const themePackage = defaultThemePackage();

if (themePackage.kind !== "ai-chatbox-theme-package" || themePackage.version !== 1) {
  throw new Error("[ChenTako Theme] Tako Festival 主题包版本不受支持");
}

// 新主题使用独立 ID，避免旧 Everforest 用户归档覆盖新版配色。
export default defineTheme(themePackage.theme);
