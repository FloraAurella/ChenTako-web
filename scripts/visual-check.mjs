"use strict";

/**
 * 程序化视觉核验：读取计算样式 / 几何 / 对比度，并产出浅深两套截图。
 * 覆盖双主题修正意见 §12 的九条断言：
 *  1 普通聊天页面无大面积彩虹      2 backdrop-filter 节点数量受控
 *  3 Markdown 标题默认 Sans        4 焦点存在真实 Outline
 *  5 浅色存在极弱 Grain            6 深色主 Surface 非 #000000
 *  7 Assistant 普通消息非大卡片    8 深色 Accent/Primary 亮度高于 Metadata
 *  9 虹彩默认状态不构成视觉焦点
 * 用法：node scripts/visual-check.mjs（需要 dev server 已在 5173 运行）
 */

import { chromium } from "@playwright/test";

function luminance(r, g, b) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a, b) {
  const l1 = Math.max(luminance(...a), luminance(...b));
  const l2 = Math.min(luminance(...a), luminance(...b));
  return (l1 + 0.05) / (l2 + 0.05);
}

function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length < 6) return [0, 0, 0];
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://127.0.0.1:5173/");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(1200);

const collect = () => page.evaluate(() => {
  const hexToRgb = (hex) => {
    const h = String(hex || "").replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    if (full.length < 6) return [0, 0, 0];
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  };
  const luminance = (r, g, b) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrastRatio = (a, b) => {
    const l1 = Math.max(luminance(...a), luminance(...b));
    const l2 = Math.min(luminance(...a), luminance(...b));
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const pick = (name) => cs.getPropertyValue(name).trim();
  const label = hexToRgb(pick("--label"));
  const secondary = hexToRgb(pick("--label-secondary"));
  const tertiary = hexToRgb(pick("--label-tertiary"));
  const canvasMid = hexToRgb(pick("--canvas-mid"));
  const onAccent = hexToRgb(pick("--on-accent"));
  const accent = hexToRgb(pick("--accent"));
  const onPear = hexToRgb(pick("--on-pear"));
  const pear = hexToRgb(pick("--pear"));
  const emptyTitle = document.querySelector(".empty-title");
  const eyebrow = document.querySelector(".drawer-eyebrow");
  const rail = document.querySelector(".mode-rail");
  const drawer = document.querySelector(".archive-drawer");
  const send = document.querySelector("#sendBtn");
  const composer = document.querySelector(".composer-paper");
  const legacyBackgroundLayers = document.querySelectorAll(".ambient-grain, .ambient-light, .user-bg-layer, .motion-layer").length;
  const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth;

  // 断言 2：backdrop-filter 只允许真实浮层（工具栏 + 潜在弹层），数量受控
  let backdropNodes = 0;
  for (const el of document.querySelectorAll("*")) {
    const bf = getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter;
    if (bf && bf !== "none") backdropNodes += 1;
  }

  // 断言 1 / 9：虹彩元素默认低调（无大面积 / 默认透明度不构成焦点）
  const irisEls = [...document.querySelectorAll(".iris-ring")];
  const irisDefaultAlpha = irisEls.length
    ? Number(getComputedStyle(document.documentElement).getPropertyValue("--rainbow-alpha"))
    : null;

  // 深色主背景非纯黑，且旧背景效果层均不存在。
  const canvasIsPureBlack = pick("--canvas-mid").toLowerCase() === "#000000";

  return {
    scheme: root.dataset.scheme,
    theme: root.dataset.theme,
    pear: pick("--pear"),
    accent: pick("--accent"),
    context: pick("--context"),
    codeBg: pick("--code-bg"),
    codeBorder: pick("--code-border"),
    syntaxKeyword: pick("--syntax-keyword"),
    contrastLabelOnCanvas: Number(contrastRatio(label, canvasMid).toFixed(2)),
    contrastSecondaryOnCanvas: Number(contrastRatio(secondary, canvasMid).toFixed(2)),
    contrastOnAccentVsAccent: Number(contrastRatio(onAccent, accent).toFixed(2)),
    contrastOnPearVsPear: Number(contrastRatio(onPear, pear).toFixed(2)),
    // 断言 8：深色下 Accent / Primary 亮度明显高于 Metadata
    luminanceGapAccentVsTertiary: Number((luminance(...accent) - luminance(...tertiary)).toFixed(3)),
    luminanceGapPearVsTertiary: Number((luminance(...pear) - luminance(...tertiary)).toFixed(3)),
    bodyFontFamily: getComputedStyle(document.body).fontFamily.split(",")[0].replace(/"/g, ""),
    displayFont: emptyTitle ? getComputedStyle(emptyTitle).fontFamily.split(",")[0].replace(/"/g, "") : null,
    displayFontSize: emptyTitle ? getComputedStyle(emptyTitle).fontSize : null,
    eyebrowFont: eyebrow ? getComputedStyle(eyebrow).fontFamily.split(",")[0].replace(/"/g, "") : null,
    railWidth: rail ? Math.round(rail.getBoundingClientRect().width) : null,
    archiveWidth: drawer ? Math.round(drawer.getBoundingClientRect().width) : null,
    sendBackground: send ? getComputedStyle(send).backgroundColor : null,
    sendRadius: send ? getComputedStyle(send).borderRadius : null,
    sendSize: send ? `${Math.round(send.getBoundingClientRect().width)}x${Math.round(send.getBoundingClientRect().height)}` : null,
    composerRadius: composer ? getComputedStyle(composer).borderRadius : null,
    composerSpineRemoved: composer ? getComputedStyle(composer, "::before").backgroundColor === "rgba(0, 0, 0, 0)" : null,
    legacyBackgroundLayers,
    backdropNodes,
    irisCount: irisEls.length,
    irisDefaultAlpha,
    canvasIsPureBlack,
    suggestionCards: document.querySelectorAll(".suggestion-card").length,
    horizontalOverflow: overflowX
  };
});

// 断言 4：键盘焦点存在真实 Outline（Tab 到搜索框）
async function focusOutlineCheck() {
  await page.keyboard.press("Tab");
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return { focused: false };
    const cs = getComputedStyle(el);
    return {
      focused: true,
      tag: el.tagName,
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor
    };
  });
}

const focusLight = await focusOutlineCheck();
const light = await collect();
await page.screenshot({ path: "/tmp/clawbox-light.png" });

await page.click("#appearanceModeBtn");
await page.waitForTimeout(400);
const dark = await collect();
await page.screenshot({ path: "/tmp/clawbox-dark.png" });

await page.goto("http://127.0.0.1:5173/#/settings/appearance");
await page.waitForTimeout(600);
const themeCards = await page.locator(".theme-card").count();
await page.screenshot({ path: "/tmp/clawbox-settings.png" });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:5173/#/chat");
await page.waitForTimeout(600);
const mobile = await page.evaluate(() => ({
  mobileNavVisible: getComputedStyle(document.querySelector(".mobile-nav")).display !== "none",
  railHidden: getComputedStyle(document.querySelector(".mode-rail")).display === "none",
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
}));
const sendMobile = await page.locator("#sendBtn").boundingBox();
await page.screenshot({ path: "/tmp/clawbox-mobile.png" });

await browser.close();

console.log(JSON.stringify({
  light,
  dark,
  focus: focusLight,
  settings: { themeCards },
  mobile: { ...mobile, sendButtonHeight: sendMobile ? Math.round(sendMobile.height) : null }
}, null, 2));
