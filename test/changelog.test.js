"use strict";

import { describe, it, expect } from "vitest";
import { RELEASE_NOTES, CURRENT_RELEASE } from "../src/modules/data/domain/changelog.js";
import { APP_SETTINGS_VERSION, APP_VERSION } from "../src/contracts/constants.js";

describe("changelog 数据源", () => {
  it("实验版本按新到旧保留为时间线历史条目", () => {
    expect(RELEASE_NOTES).toHaveLength(3);
    expect(RELEASE_NOTES.map((note) => note.version)).toEqual(["1.1.1", "1.0.0-exp-2", "1.0.0-exp"]);
    expect(RELEASE_NOTES[0].title).toContain("设置体验与主题更新");
    expect(RELEASE_NOTES[1].title).toContain("本地保存链路加固");
    expect(RELEASE_NOTES[2].title).toContain("首个实验版本");
    expect(RELEASE_NOTES.every((note) => Array.isArray(note.changes))).toBe(true);
  });

  it("当前版本与 v1.1.5 发布卡一致", () => {
    expect(CURRENT_RELEASE.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/);
    expect(CURRENT_RELEASE.version).toBe(APP_VERSION);
    expect(CURRENT_RELEASE.displayVersion).toBe(APP_SETTINGS_VERSION);
    expect(CURRENT_RELEASE.displayVersion).toBe("1.1.5");
    expect(CURRENT_RELEASE.isPatch).toBe(true);
  });

  it("v1.1.5 记录移动端适配", () => {
    const changes = CURRENT_RELEASE.changes.map((change) => change.text).join("\n");
    expect(CURRENT_RELEASE.title).toContain("v1.1.5");
    expect(changes).toContain("移动端");
    expect(changes).toContain("抽屉");
    expect(changes).toContain("44px");
  });

  it("当前记录具备完整字段", () => {
    expect(CURRENT_RELEASE.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CURRENT_RELEASE.title).toBeTruthy();
    expect(CURRENT_RELEASE.summary).toBeTruthy();
    expect(Array.isArray(CURRENT_RELEASE.changes)).toBe(true);
    expect(CURRENT_RELEASE.changes.length).toBeGreaterThan(0);
    CURRENT_RELEASE.changes.forEach((change) => {
      expect(change.tag).toBeTruthy();
      expect(change.text).toBeTruthy();
    });
  });
});
