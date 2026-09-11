"use strict";

import "../../resources/styles/index.css";
import "../../resources/styles/onboarding.css";
import { icon, pearLogo } from "../../resources/icons/index.js";

const root = document.getElementById("app");
const bridge = window.clawbox?.onboarding || null;
const schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

if (window.clawbox) document.body.classList.add("desktop-embed");

function applyScheme() {
  const dark = schemeQuery.matches;
  document.documentElement.dataset.scheme = dark ? "dark" : "light";
  document.documentElement.dataset.theme = dark ? "night-orchard" : "juicy-pear";
  document.documentElement.dataset.themeBase = dark ? "dark" : "light";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render(status = {}) {
  root.innerHTML = [
    `<main class="onboarding-canvas">`,
    `<div class="window-drag-band" aria-hidden="true"></div>`,
    `<section class="onboarding-shell" aria-labelledby="onboardingTitle">`,
    `<header class="onboarding-brand">`,
    `<span class="onboarding-logo">${pearLogo(21)}</span>`,
    `<span>Clawbox</span>`,
    `<span class="onboarding-local-label">LOCAL FIRST</span>`,
    `</header>`,
    `<div class="onboarding-grid">`,
    `<div class="onboarding-copy">`,
    `<p class="onboarding-eyebrow">FIRST OPEN · 第一次打开</p>`,
    `<h1 id="onboardingTitle">从这里，决定第一份记忆</h1>`,
    `<p class="onboarding-lede">Clawbox 没有云端账户。请选择建立一套全新的本机数据，或把另一台设备的对话、主题与设置带到这里。</p>`,
    `<div class="onboarding-actions">`,
    `<button type="button" class="onboarding-choice is-primary" id="onboardingFreshBtn">`,
    `<span class="choice-icon">${icon("spark", 19)}</span>`,
    `<span class="choice-copy"><strong>启动全新 Clawbox</strong><small>创建空白的隐藏数据目录，从一段新对话开始。</small></span>`,
    `<span class="choice-arrow">${icon("chevronRight", 17)}</span>`,
    `</button>`,
    `<button type="button" class="onboarding-choice" id="onboardingImportBtn">`,
    `<span class="choice-icon">${icon("archive", 19)}</span>`,
    `<span class="choice-copy"><strong>从迁移包导入</strong><small>选择 Clawbox Migration ZIP，验证后原子恢复本机数据。</small></span>`,
    `<span class="choice-arrow">${icon("chevronRight", 17)}</span>`,
    `</button>`,
    `</div>`,
    `<div class="onboarding-status" id="onboardingStatus" role="status" aria-live="polite"></div>`,
    `</div>`,
    `<aside class="migration-seal" aria-label="迁移包由加密数据和密钥两个文件组成">`,
    `<div class="seal-caption"><span>迁移封套</span><span>AES · 128 BIT</span></div>`,
    `<div class="seal-stack">`,
    `<div class="seal-file seal-data">`,
    `<span class="seal-file-icon">${icon("database", 22)}</span>`,
    `<span class="seal-file-type">ENCRYPTED DATA</span>`,
    `<strong>Clawbox-Data</strong>`,
    `<small>对话 · 附件 · 主题 · 设置</small>`,
    `</div>`,
    `<div class="seal-file seal-key">`,
    `<span class="seal-file-icon">${icon("key", 20)}</span>`,
    `<span class="seal-file-type">KEY.MD</span>`,
    `<strong>128 位密钥</strong>`,
    `<small>随迁移 ZIP 一起保存</small>`,
    `</div>`,
    `<span class="seal-stamp">${icon("shield", 18)} VERIFIED</span>`,
    `</div>`,
    `<p class="seal-note">导入前会检查文件路径、AES-GCM 完整性与逐文件 SHA-256 清单；失败不会创建半成品数据目录。</p>`,
    `</aside>`,
    `</div>`,
    `<footer class="onboarding-footer">`,
    `<span>${icon("shield", 13)} 数据只写入这台 Mac</span>`,
    status.storageLocation
      ? `<code title="${escapeHtml(status.storageLocation)}">Application Support/.clawbox</code>`
      : `<code>Application Support/.clawbox</code>`,
    `</footer>`,
    `</section>`,
    `</main>`
  ].join("");

  const freshButton = document.getElementById("onboardingFreshBtn");
  const importButton = document.getElementById("onboardingImportBtn");
  if (!bridge || status.required === false) {
    freshButton.disabled = true;
    importButton.disabled = true;
    showStatus("此页面只能在 Clawbox 首次启动时使用。", "error");
    return;
  }
  freshButton.addEventListener("click", () => runAction("fresh"));
  importButton.addEventListener("click", () => runAction("import"));
  freshButton.focus();
}

function setBusy(busy, message = "") {
  const shell = document.querySelector(".onboarding-shell");
  const freshButton = document.getElementById("onboardingFreshBtn");
  const importButton = document.getElementById("onboardingImportBtn");
  shell?.setAttribute("aria-busy", String(busy));
  shell?.classList.toggle("is-busy", busy);
  if (freshButton) freshButton.disabled = busy;
  if (importButton) importButton.disabled = busy;
  if (message) showStatus(`${icon("refresh", 14)} ${message}`, "busy", true);
}

function showStatus(message, tone = "neutral", trusted = false) {
  const node = document.getElementById("onboardingStatus");
  if (!node) return;
  node.dataset.tone = tone;
  if (trusted) node.innerHTML = message;
  else node.textContent = message;
}

async function runAction(kind) {
  if (!bridge) return;
  const isImport = kind === "import";
  setBusy(true, isImport ? "正在选择并验证迁移包…" : "正在创建本机数据目录…");
  try {
    const result = isImport ? await bridge.importPackage() : await bridge.startFresh();
    if (result?.cancelled) {
      setBusy(false);
      showStatus("已取消导入；你仍可以选择任一种启动方式。", "neutral");
      return;
    }
    showStatus(`${icon("check", 14)} 已完成，Clawbox 正在打开…`, "success", true);
  } catch (error) {
    setBusy(false);
    showStatus(`未能完成：${error.message || "未知错误"}`, "error");
  }
}

applyScheme();
schemeQuery.addEventListener?.("change", applyScheme);

Promise.resolve(bridge?.getStatus?.())
  .then((status) => render(status || {}))
  .catch((error) => {
    render({ required: false });
    showStatus(`无法读取首次启动状态：${error.message}`, "error");
  });
