import { describe, expect, it } from "vitest";
import {
  collectAttachmentItems,
  createAttachmentBudget,
  createMessageAttachmentBudget,
  dataUrlBlob,
  mimeForFile
} from "../src/modules/attachments/services/attachments.js";

describe("聊天附件服务", () => {
  it("按现有附件记录计算三类配额", () => {
    expect(createAttachmentBudget([
      { kind: "file", size: 12 },
      { kind: "image", size: 20 },
      { kind: "media", size: 30 }
    ])).toEqual({ fileBytes: 12, imageCount: 1, imageBytes: 20, mediaCount: 1, mediaBytes: 30 });
  });

  it("从编辑中的消息复原文件、图片与二进制附件预算", () => {
    const budget = createMessageAttachmentBudget({
      files: [{ name: "note.txt", text: "abcdef" }],
      parts: [
        { type: "image", source: "data:image/png;base64,AAAA" },
        { type: "file", source: "data:application/pdf;base64,AAAA", size: 88 }
      ]
    });
    expect(budget).toEqual({ fileBytes: 6, imageCount: 1, imageBytes: 20, mediaCount: 1, mediaBytes: 88 });
  });

  it("保留文本附件读取与通知契约", async () => {
    const notices = [];
    const items = await collectAttachmentItems([{
      name: "outline.txt",
      type: "text/plain",
      size: 12,
      text: async () => "first\nsecond"
    }], createAttachmentBudget([]), (...args) => notices.push(args));

    expect(notices).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "file", name: "outline.txt", text: "first\nsecond", size: 12 });
  });

  it("为无 MIME 的文件回退既有扩展映射，并将 data URL 转换为 Blob", async () => {
    expect(mimeForFile({ name: "report.pdf", type: "" })).toBe("application/pdf");
    expect(mimeForFile({ name: "unknown.asset", type: "" })).toBe("application/octet-stream");
    expect(dataUrlBlob("data:text/plain;base64,aGVsbG8=", "text/plain")).toMatchObject({ type: "text/plain", size: 5 });
    expect(dataUrlBlob("data:text/plain,hello%20world", "text/plain")).toMatchObject({ type: "text/plain", size: 11 });
  });
});
