"use strict";

import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { buildStoredZip } from "../src/modules/data/domain/archive.js";
import { crc32 } from "../src/modules/data/domain/archive.js";
import { parseSkillMarkdownText, parseSkillZip } from "../src/modules/extensions/domain/skill-package.js";

function buildDeflatedZip(name, data) {
  const nameBytes = new TextEncoder().encode(name);
  const compressed = deflateRawSync(data);
  const crc = crc32(data);
  const local = new Uint8Array(30 + nameBytes.length);
  const localView = new DataView(local.buffer);
  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint16(6, 0x0800, true);
  localView.setUint16(8, 8, true);
  localView.setUint32(14, crc, true);
  localView.setUint32(18, compressed.length, true);
  localView.setUint32(22, data.length, true);
  localView.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);

  const central = new Uint8Array(46 + nameBytes.length);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint16(8, 0x0800, true);
  centralView.setUint16(10, 8, true);
  centralView.setUint32(16, crc, true);
  centralView.setUint32(20, compressed.length, true);
  centralView.setUint32(24, data.length, true);
  centralView.setUint16(28, nameBytes.length, true);
  central.set(nameBytes, 46);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, 1, true);
  endView.setUint16(10, 1, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length + compressed.length, true);
  const output = new Uint8Array(local.length + compressed.length + central.length + end.length);
  output.set(local, 0);
  output.set(compressed, local.length);
  output.set(central, local.length + compressed.length);
  output.set(end, local.length + compressed.length + central.length);
  return output;
}

describe("Skill 文件导入", () => {
  it("从 Markdown 标题与正文生成只读 Skill 定义", () => {
    const result = parseSkillMarkdownText([
      "---",
      "name: 代码审查",
      "description: 先验证，再给出最小修复。",
      "---",
      "",
      "# 代码审查",
      "",
      "1. 先复现问题。",
      "2. 再给出最小修复。"
    ].join("\n"), "review.md");
    expect(result).toEqual({
      name: "代码审查",
      description: "先验证，再给出最小修复。",
      instructions: "# 代码审查\n\n1. 先复现问题。\n2. 再给出最小修复。",
      sourceFile: "review.md"
    });
  });

  it("从 ZIP 中提取多个 Markdown，并拒绝路径穿越", async () => {
    const encoder = new TextEncoder();
    const zip = buildStoredZip([
      { name: "skills/review.md", data: encoder.encode("# 审查\n只报告可复现问题。") },
      { name: "skills/translate.md", data: encoder.encode("# 翻译\n保持术语一致。") }
    ]);
    await expect(parseSkillZip(zip)).resolves.toHaveLength(2);

    const unsafe = buildStoredZip([{ name: "../secret.md", data: encoder.encode("# 不能导入") }]);
    await expect(parseSkillZip(unsafe)).rejects.toThrow(/不安全路径/);
  });

  it("支持常见的 deflate 压缩 ZIP", async () => {
    const data = new TextEncoder().encode("# 压缩 Skill\n保持原文。\n");
    const entries = await parseSkillZip(buildDeflatedZip("compressed.md", data));
    expect(entries[0].name).toBe("compressed.md");
    expect(Array.from(entries[0].data)).toEqual(Array.from(data));
  });

  it("拒绝空 Markdown 与超过 16KB 的正文", () => {
    expect(() => parseSkillMarkdownText("   ", "empty.md")).toThrow(/为空/);
    expect(() => parseSkillMarkdownText("# 太大\n" + "x".repeat(16 * 1024), "large.md")).toThrow(/16KB/);
  });
});
