"use strict";

import { describe, it, expect } from "vitest";
import {
  normalizeRemovedIds,
  withRemovedId,
  withoutRemovedId,
  resolveSeedAdditions,
  filterRetiredArchiveFiles,
  MAX_REMOVED_IDS
} from "../src/modules/appearance/domain/seed.js";

const BUILTIN = { id: "juicy-pear", builtin: true, label: "晨光" };
const NIGHT = { id: "night-orchard", builtin: true, label: "月影" };
const SOURCE = { id: "everforest", sourceCustom: true, label: "Everforest" };
const USER = { id: "my-theme", user: true, label: "我的" };

function themeFiles(ids) {
  return ids.map((id) => ({ id, path: `themes/${id}.theme.json` }));
}

describe("normalizeRemovedIds", () => {
  it("旧档案没有该字段时补默认空数组", () => {
    expect(normalizeRemovedIds(undefined)).toEqual([]);
    expect(normalizeRemovedIds(null)).toEqual([]);
    expect(normalizeRemovedIds("")).toEqual([]);
  });

  it("去重并保留合法 ID", () => {
    expect(normalizeRemovedIds(["a-b", "a-b", "c-d"])).toEqual(["a-b", "c-d"]);
  });

  it("非法 ID 与超限拒绝", () => {
    expect(() => normalizeRemovedIds(["Bad-ID"])).toThrow(/非法主题 ID/);
    expect(() => normalizeRemovedIds("not-array")).toThrow(/必须是数组/);
    const overload = Array.from({ length: MAX_REMOVED_IDS + 1 }, (_, index) => `t-${index}`);
    expect(() => normalizeRemovedIds(overload)).toThrow(/不能超过/);
  });
});

describe("withRemovedId / withoutRemovedId", () => {
  it("追加去重，满额时不再记录而不抛错", () => {
    expect(withRemovedId([], "seaside")).toEqual(["seaside"]);
    expect(withRemovedId(["seaside"], "seaside")).toEqual(["seaside"]);
    const full = Array.from({ length: MAX_REMOVED_IDS }, (_, index) => `t-${index}`);
    expect(withRemovedId(full, "new-one")).toEqual(full);
  });

  it("移除指定墓碑", () => {
    expect(withoutRemovedId(["seaside", "a-b"], "seaside")).toEqual(["a-b"]);
    expect(withoutRemovedId([], "seaside")).toEqual([]);
  });
});

describe("filterRetiredArchiveFiles", () => {
  it("裁剪已退役墓碑中的档案文件，其余保留", () => {
    const files = themeFiles(["seaside", "argenteuil", "my-theme"]);
    const result = filterRetiredArchiveFiles(files, ["argenteuil", "seine-morning"]);
    expect(result.pruned).toBe(true);
    expect(result.files.map((file) => file.id)).toEqual(["seaside", "my-theme"]);
  });

  it("无墓碑或不含退役文件时原样返回", () => {
    const files = themeFiles(["seaside", "my-theme"]);
    const clean = filterRetiredArchiveFiles(files, []);
    expect(clean.pruned).toBe(false);
    expect(clean.files).toHaveLength(2);
    expect(filterRetiredArchiveFiles(undefined, []).files).toEqual([]);
  });

  it("缺席文件 ID 的条目不裁剪（防御性）", () => {
    const result = filterRetiredArchiveFiles([{ path: "themes/x.theme.json" }, { id: "argenteuil" }], ["argenteuil"]);
    expect(result.pruned).toBe(true);
    expect(result.files).toHaveLength(1);
  });
});

describe("resolveSeedAdditions", () => {
  it("档案缺 ID 且无墓碑 → 补种内置与源码主题，用户主题不参与", () => {
    const additions = resolveSeedAdditions([BUILTIN, NIGHT, SOURCE, USER], themeFiles(["night-orchard"]), []);
    expect(additions.map((theme) => theme.id)).toEqual(["juicy-pear", "everforest"]);
  });

  it("档案已有同 ID → 以档案为准，不再补种", () => {
    const additions = resolveSeedAdditions([BUILTIN, SOURCE], themeFiles(["juicy-pear", "everforest"]), []);
    expect(additions).toEqual([]);
  });

  it("处于删除墓碑中的种子主题不再补种", () => {
    const additions = resolveSeedAdditions([BUILTIN, SOURCE], themeFiles(["night-orchard"]), ["juicy-pear"]);
    expect(additions.map((theme) => theme.id)).toEqual(["everforest"]);
  });

  it("同一 ID 只补种一次（去重）", () => {
    const additions = resolveSeedAdditions(
      [{ id: "everforest", sourceCustom: true }, { id: "everforest", sourceCustom: true }],
      [],
      []
    );
    expect(additions).toHaveLength(1);
  });

  it("旧档案只有海盐时只补种新的 Everforest 源码主题", () => {
    const additions = resolveSeedAdditions(
      [SOURCE, USER],
      themeFiles(["seaside", "my-theme"]),
      []
    );
    expect(additions.map((theme) => theme.id)).toEqual(["everforest"]);
  });

  it("用户删除过 Everforest 主题后升级不会自动复活", () => {
    const additions = resolveSeedAdditions(
      [SOURCE],
      themeFiles(["seaside"]),
      ["everforest"]
    );
    expect(additions).toEqual([]);
  });
});
