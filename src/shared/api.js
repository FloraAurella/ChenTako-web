"use strict";

/**
 * 统一请求封装：浏览器直连相对路径；Electron 渲染进程通过
 * clawbox 桥附加 base URL 与 x-clawbox-token 启动令牌。
 */

export function desktopBridge() {
  return typeof window !== "undefined" ? (window["ai-chatbox"] ?? window.clawbox) : undefined;
}

// GitHub Pages cannot proxy /api requests. A Pages build may inject the public
// backend origin with VITE_API_BASE_URL; local development keeps relative URLs.
const configuredApiBase = String(import.meta.env?.VITE_API_BASE_URL || "").replace(/\/+$/, "");

/** Cloud credentials identify this browser's isolated vault, never another visitor's.
 * @param {Pick<Storage, 'getItem' | 'setItem'>} storage
 */
export function browserApiCredential(storage = localStorage) {
  const key = 'chentako-cloud-credential-v1';
  let credential = storage.getItem(key);
  if (credential !== null && !/^[a-f0-9]{64}$/.test(credential)) throw new Error('云端连接凭据损坏，请恢复浏览器数据后重试。');
  if (!credential) {
    credential = Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('');
    storage.setItem(key, credential);
    if (storage.getItem(key) !== credential) throw new Error('浏览器无法保存云端连接凭据，已阻止请求。');
  }
  return credential;
}

export function apiFetch(path, options = {}) {
  const bridge = desktopBridge();
  const url = bridge && bridge.backendBase
    ? `${String(bridge.backendBase).replace(/\/+$/, "")}${path}`
    : `${configuredApiBase}${path}`;
  const headers = new Headers(options.headers || {});
  if (configuredApiBase && !bridge?.backendBase) headers.set('x-chentako-vault', browserApiCredential());
  if (bridge && bridge.apiToken) headers.set(window["ai-chatbox"] ? "x-ai-chatbox-token" : "x-clawbox-token", bridge.apiToken);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...options, headers });
}
