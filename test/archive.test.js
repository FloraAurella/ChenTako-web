"use strict";

import { describe, it, expect } from "vitest";
import {
  crc32,
  buildStoredZip,
  parseStoredZip,
  exportConversationArchive,
  importConversationArchive
} from "../src/modules/data/domain/archive.js";
import { normalizeConversation } from "../src/contracts/normalize.js";

describe("crc32", () => {
  it("已知校验值", () => {
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
    expect(crc32(new Uint8Array([]))).toBe(0);
  });
});

describe("buildStoredZip / parseStoredZip", () => {
  it("往返一致（含中文文件名）", () => {
    const encoder = new TextEncoder();
    const zip = buildStoredZip([
      { name: "conversation.json", data: encoder.encode('{"kind":"x"}') },
      { name: "media/0001.png", data: new Uint8Array([1, 2, 3, 255]) }
    ]);
    const entries = parseStoredZip(new Uint8Array(zip));
    expect(entries.map((entry) => entry.name)).toEqual(["conversation.json", "media/0001.png"]);
    expect(new TextDecoder().decode(entries[0].data)).toBe('{"kind":"x"}');
    expect([...entries[1].data]).toEqual([1, 2, 3, 255]);
  });

  it("拒绝路径穿越条目", () => {
    const zip = buildStoredZip([{ name: "../evil.txt", data: new Uint8Array([1]) }]);
    expect(() => parseStoredZip(new Uint8Array(zip))).toThrow(/不安全路径/);
  });

  it("CRC 校验失败抛错", () => {
    const encoder = new TextEncoder();
    const zip = buildStoredZip([{ name: "a.txt", data: encoder.encode("original") }]);
    zip[40] ^= 0xff; // 破坏数据区一个字节
    expect(() => parseStoredZip(new Uint8Array(zip))).toThrow(/CRC/);
  });
});

describe("会话归档导出 / 导入", () => {
  const pngDataUrl = "data:image/png;base64,aGVsbG8=";
  const conversation = normalizeConversation({
    id: "conv-1",
    title: "带图的对话",
    providerId: "p1",
    providerSnapshot: { displayName: "示例", baseUrl: "https://api.example.com", responseFormat: "openai-compatible" },
    model: "m-1",
    messages: [
      { id: "m1", role: "user", content: "画一张图", files: [{ name: "note.txt", text: "附件内容" }] },
      {
        id: "m2",
        role: "assistant",
        content: "给图",
        parts: [{ type: "image", source: pngDataUrl, mimeType: "image/png", alt: "生成" }]
      }
    ]
  });

  it("导出：conversation.json + media/ 图片（v3 结构）", () => {
    const { entries, filename } = exportConversationArchive(conversation);
    expect(filename).toMatch(/\.ai-chatbox\.zip$/);
    expect(entries[0].name).toBe("conversation.json");
    const payload = JSON.parse(new TextDecoder().decode(entries[0].data));
    expect(payload.kind).toBe("ai-chatbox-conversation");
    expect(payload.version).toBe(3);
    expect(payload.conversation.messages[1].parts[0].media).toMatch(/^media\//);
    expect(entries.some((entry) => entry.name.startsWith("media/"))).toBe(true);
  });

  it("ZIP 往返导入：图片恢复为 data URL，标题追加（导入）", async () => {
    const { bytes } = exportConversationArchive(conversation);
    const file = new File([bytes], "test.clawbox.zip");
    const imported = await importConversationArchive(file, []);
    expect(imported.title).toBe("带图的对话（导入）");
    expect(imported.imported).toBe(true);
    const imagePart = imported.messages[1].parts.find((part) => part.type === "image");
    expect(imagePart.source).toBe(pngDataUrl);
    expect(imported.messages[0].files[0].text).toBe("附件内容");
  });

  it("JSON 导入与供应商匹配", async () => {
    const jsonPayload = {
      kind: "clawbox-conversation",
      version: 2,
      conversation: {
        id: "conv-9",
        title: "外来对话",
        providerId: "p-missing",
        providerSnapshot: { displayName: "示例", baseUrl: "https://api.example.com", responseFormat: "openai-compatible" },
        messages: [{ id: "x", role: "user", content: "hi" }]
      }
    };
    const file = new File([JSON.stringify(jsonPayload)], "chat.json", { type: "application/json" });
    const providers = [{ id: "p-1", displayName: "示例", baseUrl: "https://api.example.com", responseFormat: "openai-compatible", models: [] }];
    const imported = await importConversationArchive(file, providers);
    expect(imported.providerId).toBe("p-1");
    expect(imported.messages).toHaveLength(1);
  });

  it("v3 归档保留活动分支选择", async () => {
    const branched = normalizeConversation({
      id: "branched",
      messages: [
        { id: "u1", role: "user", content: "A" },
        { id: "a1", role: "assistant", content: "A答" },
        { id: "u2", role: "user", content: "B", parentId: "a1" },
        { id: "u2b", role: "user", content: "B改", parentId: "a1" },
        { id: "a2b", role: "assistant", content: "B改答", parentId: "u2b" }
      ],
      activeChildByMessageId: { u1: "a1", a1: "u2b", u2b: "a2b" },
      activeRootMessageId: "u1"
    });
    const { bytes } = exportConversationArchive(branched);
    const imported = await importConversationArchive(new File([bytes], "branched.zip"), []);
    expect(imported.activeRootMessageId).toBe("u1");
    expect(imported.activeChildByMessageId.a1).toBe("u2b");
    expect(imported.messages.find((message) => message.id === "u2b").parentId).toBe("a1");
  });

  it("拒绝超大导入文件", async () => {
    const stub = { size: 200 * 1024 * 1024, name: "big.zip" };
    await expect(importConversationArchive(stub, [])).rejects.toThrow(/130MB/);
  });
});
