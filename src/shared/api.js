"use strict";

/**
 * 统一请求封装：浏览器直连相对路径；Electron 渲染进程通过
 * clawbox 桥附加 base URL 与 x-clawbox-token 启动令牌。
 */

export function desktopBridge() {
  return typeof window !== "undefined" ? window.clawbox : undefined;
}

export function apiFetch(path, options = {}) {
  const bridge = desktopBridge();
  const url = bridge && bridge.backendBase
    ? `${String(bridge.backendBase).replace(/\/+$/, "")}${path}`
    : path;
  const headers = new Headers(options.headers || {});
  if (bridge && bridge.apiToken) headers.set("x-clawbox-token", bridge.apiToken);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...options, headers });
}
