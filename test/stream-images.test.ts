"use strict";

import { afterEach, describe, expect, it, vi } from "vitest";
import { mountImageGenerationSlot, paintStreamImages } from "../src/modules/chat/services/stream-images";

function assistantEntry(): HTMLElement {
  document.body.innerHTML = '<article class="message-entry assistant"><div class="message-body"><div class="markdown-body"></div></div></article>';
  return document.querySelector(".message-entry") as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("stream image slots", () => {
  it("立即创建 1:1 等待槽且不写入持久消息结构", () => {
    const entry = assistantEntry();
    const region = mountImageGenerationSlot(entry, "message-1");
    const slot = region?.querySelector(".stream-image-slot") as HTMLButtonElement;

    expect(region?.getAttribute("data-stream-images")).toBe("true");
    expect(slot.disabled).toBe(true);
    expect(slot.getAttribute("aria-label")).toBe("图片生成中");
    expect(slot.querySelector('[role="status"]')?.textContent).toContain("正在生成图片");
  });

  it("图片解码成功后原位替换等待态并恢复预览按钮", async () => {
    const entry = assistantEntry();
    mountImageGenerationSlot(entry, "message-2");
    const onCommit = vi.fn();
    const painting = paintStreamImages({
      entry,
      messageId: "message-2",
      images: [{ source: "data:image/png;base64,aGVsbG8=", alt: "测试图片" }],
      onCommit
    });
    const slot = entry.querySelector(".stream-image-slot") as HTMLButtonElement;
    const img = slot.querySelector("img") as HTMLImageElement;
    img.dispatchEvent(new Event("load"));
    await painting;

    expect(slot.classList.contains("is-ready")).toBe(true);
    expect(slot.disabled).toBe(false);
    expect(slot.getAttribute("aria-label")).toBe("放大图片");
    expect(img.getAttribute("alt")).toBe("测试图片");
    expect(slot.querySelector(".image-generation-placeholder")?.getAttribute("aria-hidden")).toBe("true");
    expect(onCommit).toHaveBeenCalled();
  });

  it("图片加载失败时保留单一可诊断占位而不暴露破损按钮", async () => {
    const entry = assistantEntry();
    const painting = paintStreamImages({
      entry,
      messageId: "message-3",
      images: [{ source: "https://example.invalid/image.png" }]
    });
    const slot = entry.querySelector(".stream-image-slot") as HTMLButtonElement;
    slot.querySelector("img")?.dispatchEvent(new Event("error"));
    await painting;

    expect(slot.classList.contains("is-failed")).toBe(true);
    expect(slot.disabled).toBe(true);
    expect(slot.querySelector(".image-generation-label")?.textContent).toContain("图片加载失败");
  });
});
