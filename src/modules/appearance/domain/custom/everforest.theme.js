"use strict";

/**
 * Clawbox 随附的唯一默认主题：Everforest。
 * 主题定义直接来自可导入的 JSON 主题包，避免运行时默认值与分发文件漂移。
 */

import { defineTheme } from "../contract.js";
import { defaultThemePackage } from "../../../../resources/themes/default.js";
const themePackage = defaultThemePackage();

if (themePackage.kind !== "clawbox-theme-package" || themePackage.version !== 1) {
  throw new Error("[Clawbox Theme] Everforest 主题包版本不受支持");
}

export default defineTheme(themePackage.theme);
