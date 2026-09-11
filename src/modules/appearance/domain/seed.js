"use strict";

/**
 * 主题种子与删除墓碑。
 *
 * 主题包档案是唯一真源：硬编码主题（内置色板主题、custom/*.theme.js 源码主题）
 * 只在主题包缺失（首次启动）时作为种子迁入，之后一律以档案为准——用户删除、
 * 更新（同 ID 重新导入）都会持久。
 *
 * 删除墓碑（removedIds）：用户删除过的种子主题不再复活；应用升级新增的内置 /
 * 源码主题（档案从未见过该 ID）仍会被补种回来。
 */

import { isValidThemeId } from "./contract.js";

export const MAX_REMOVED_IDS = 128;

/** 归一化档案载荷里的 removedIds：旧档案（undefined）补空数组，非法值抛错。 */
export function normalizeRemovedIds(value) {
  if (value === undefined || value === null || value === "") return [];
  if (!Array.isArray(value)) throw new Error("removedIds 必须是数组");
  const seen = new Set();
  const result = [];
  for (const id of value) {
    if (typeof id !== "string" || !isValidThemeId(id)) {
      throw new Error("removedIds 包含非法主题 ID");
    }
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length > MAX_REMOVED_IDS) {
      throw new Error(`removedIds 不能超过 ${MAX_REMOVED_IDS} 项`);
    }
  }
  return result;
}

/** 记录主题被删除（墓碑）；已存在或已满额时原样返回，不抛错。 */
export function withRemovedId(removedIds, id) {
  const next = normalizeRemovedIds(removedIds);
  if (!isValidThemeId(String(id || "")) || next.includes(String(id))) return next;
  if (next.length >= MAX_REMOVED_IDS) return next;
  return [...next, String(id)];
}

/** 主题被重新导入/更新时清除墓碑。 */
export function withoutRemovedId(removedIds, id) {
  return normalizeRemovedIds(removedIds).filter((value) => value !== String(id));
}

/**
 * 计算本轮应补种进档案的种子主题。
 * 只考虑当前注册表中 builtin 或 sourceCustom 的主题；档案已有同 ID 文件时
 * 以档案为准（用户更新/删除都持久），处于删除墓碑中的 ID 不再补种。
 */
export function resolveSeedAdditions(registeredThemes, archiveFiles, removedIds) {
  const archiveIds = new Set((Array.isArray(archiveFiles) ? archiveFiles : [])
    .map((file) => file && typeof file === "object" ? file.id : "")
    .filter(Boolean));
  const tombstones = new Set(normalizeRemovedIds(removedIds));
  const additions = [];
  const seen = new Set();
  for (const theme of Array.isArray(registeredThemes) ? registeredThemes : []) {
    if (!theme || typeof theme !== "object" || !isValidThemeId(theme.id)) continue;
    const isSeed = theme.builtin === true || theme.sourceCustom === true;
    if (!isSeed || archiveIds.has(theme.id) || tombstones.has(theme.id)) continue;
    if (seen.has(theme.id)) continue;
    seen.add(theme.id);
    additions.push(theme);
  }
  return additions;
}

/**
 * 裁剪档案中已退役（处于删除墓碑）的主题文件：墓碑只挡补种，档案残留的
 * 旧文件必须一并移除，否则已删除/已退役主题每启动都会复活。
 * 用户重新导入同 ID 主题包时会先清除墓碑再写入，不受影响。
 */
export function filterRetiredArchiveFiles(files, removedIds) {
  const tombstones = new Set(normalizeRemovedIds(removedIds));
  const kept = [];
  let pruned = false;
  for (const file of Array.isArray(files) ? files : []) {
    if (file && typeof file === "object" && file.id && tombstones.has(file.id)) {
      pruned = true;
      continue;
    }
    kept.push(file);
  }
  return { files: kept, pruned };
}
