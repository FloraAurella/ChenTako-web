"use strict";

/** 共享格式化与 DOM 工具。 */

import { LIMITS } from "../contracts/constants.js";
import { LIGHT_TOKENS } from "../modules/appearance/public/domain_base-themes.js";
import { icon } from "../resources/icons/index.js";
import { reportInlineFeedback } from "./overlays/inline-error-service.ts";

export function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return formatTime(timestamp);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "昨天";
  const sameYear = date.getFullYear() === now.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return sameYear ? `${month}-${day}` : `${date.getFullYear()}-${month}-${day}`;
}

/** Local calendar days, independent of elapsed hours and daylight-saving changes. */
export function daysSinceToday(timestamp, now = new Date()) {
  const date = new Date(timestamp);
  if (timestamp == null || !Number.isFinite(date.getTime())) return null;
  const calendarDay = value => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  return Math.max(0, Math.round((calendarDay(now) - calendarDay(date)) / 86400000));
}

export function formatRelativeDays(timestamp, now = new Date()) {
  const days = daysSinceToday(timestamp, now);
  return days === null ? "" : days === 0 ? "今天" : `${days}天`;
}

export function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m${String(rest).padStart(2, "0")}s`;
}

export function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function formatTokenCount(count) {
  const value = Math.max(0, Math.floor(Number(count) || 0));
  if (value >= 10000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(value);
}

export function truncateText(text, max = LIMITS.titleLength) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

const GROUP_COLOR_TOKENS = [
  "--group-color-1",
  "--group-color-2",
  "--group-color-3",
  "--group-color-4",
  "--group-color-5"
];
// 兜底值来自唯一色板数据源（浅色基线），保证与 tokens.css 的 --group-color-* 永不漂移
const GROUP_COLOR_FALLBACKS = GROUP_COLOR_TOKENS.map((token) => LIGHT_TOKENS[token]);

export function colorForKey(key) {
  const value = String(key || "");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  const index = hash % GROUP_COLOR_TOKENS.length;
  if (typeof document !== "undefined") {
    const themed = getComputedStyle(document.documentElement).getPropertyValue(GROUP_COLOR_TOKENS[index]).trim();
    if (themed) return themed;
  }
  return GROUP_COLOR_FALLBACKS[index];
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function copyText(text) {
  const value = String(text ?? "");
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* 回退 execCommand */ }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export function safeFilename(name, fallback = "ai-chatbox") {
  const cleaned = String(name || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 60);
  return cleaned || fallback;
}

/** 顶栏后端状态胶囊（三态：检查中 / 正常 / 离线）。 */
export function backendStatusHtml(backend) {
  const state = backend && backend.status ? backend.status : "checking";
  const tone = state === "ok" ? "ok" : state === "down" ? "down" : "checking";
  const label = state === "ok" ? "本地服务正常" : state === "down" ? "本地服务离线" : "检查中";
  const title = `title="${escapeAttrValue(state === "down" && backend.message ? backend.message : label)}"`;
  return `<span class="status-pill" data-backend="${state}" ${title}><span class="status-dot" data-tone="${tone}"></span><span class="status-label">${label}</span></span>`;
}

function escapeAttrValue(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** 兼容控制器回调：只把 danger 反馈交给页面内联错误行。 */
export function showInlineFeedback(message, { tone = "info", host } = {}) {
  void host;
  reportInlineFeedback(message, { tone });
}
