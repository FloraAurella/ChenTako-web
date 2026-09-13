"use strict";

import { describe, it, expect } from "vitest";
import {
  normalizeProviderResponse,
  extractProviderOutputImages,
  extractProviderOutputFiles,
  normalizeProviderImageSource
} from "../src/modules/connections/domain/adapters.js";

describe("normalizeProviderResponse（非流式）", () => {
  it("openai-compatible：choices[0].message", () => {
    const result = normalizeProviderResponse({
      choices: [{ message: { content: "你好", reasoning_content: "思考" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
    }, "openai-compatible");
    expect(result.content).toBe("你好");
    expect(result.reasoning).toBe("思考");
    expect(result.usage.totalTokens).toBe(2);
  });

  it("非流式正文中的 think 标签会拆到思考面板", () => {
    const result = normalizeProviderResponse({
      choices: [{ message: { content: "开场<think>内部推理</think>最终回答" } }]
    }, "openai-compatible");
    expect(result.reasoning).toBe("内部推理");
    expect(result.reasoningKind).toBe("thinking");
    expect(result.content).toBe("开场最终回答");
  });

  it("anthropic：content blocks 分离 thinking/text/图片", () => {
    const result = normalizeProviderResponse({
      content: [
        { type: "thinking", thinking: "推理" },
        { type: "text", text: "回答" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: "eHg=" } }
      ]
    }, "anthropic");
    expect(result.reasoning).toBe("推理");
    expect(result.content).toBe("回答");
    expect(result.images[0].source).toContain("data:image/png");
  });

  it("responses：output 数组与 output_text 兜底", () => {
    const result = normalizeProviderResponse({
      output: [{ type: "message", content: [{ type: "output_text", text: "正文" }] }]
    }, "responses");
    expect(result.content).toBe("正文");
    expect(result.reasoningKind).toBe("summary");
    const fallback = normalizeProviderResponse({ output_text: "兜底" }, "responses");
    expect(fallback.content).toBe("兜底");
  });

  it("ChenTako 标准化响应保留图片与 Tool 执行记录", () => {
    const result = normalizeProviderResponse({
      content: "已经查询完成。",
      reasoning: "选择工具",
      reasoningKind: "thinking",
      images: [{ source: "eHg=", mimeType: "image/png", alt: "图片" }],
      toolEvents: [{ callId: "call-1", name: "weather_lookup", status: "succeeded" }]
    }, "responses");
    expect(result.content).toBe("已经查询完成。");
    expect(result.images[0].source).toBe("data:image/png;base64,eHg=");
    expect(result.toolEvents).toHaveLength(1);
  });

  it("ChenTako 标准化响应优先读取统一 extensionEvents", () => {
    const result = normalizeProviderResponse({
      content: "运行时完成。",
      extensionEvents: [
        { type: "skill_applied", source: "skill", name: "代码审查" },
        { type: "tool_result", source: "sandbox", name: "run_command", status: "succeeded" }
      ],
      toolEvents: [{ type: "tool_result", name: "不应重复" }]
    });
    expect(result.toolEvents.map((event) => event.name)).toEqual(["代码审查", "run_command"]);
  });
});

describe("normalizeProviderImageSource", () => {
  it("保留安全 URL，裸 base64 补 MIME，普通文本不伪装为图片", () => {
    expect(normalizeProviderImageSource("https://example.com/image.png")).toBe("https://example.com/image.png");
    expect(normalizeProviderImageSource("eHg=", "image/webp")).toBe("data:image/webp;base64,eHg=");
    expect(normalizeProviderImageSource("not:an:image")).toBe("not:an:image");
  });
});

describe("extractProviderOutputImages", () => {
  it("兼容格式 images 字段", () => {
    const images = extractProviderOutputImages({
      message: { images: [{ source: "https://a.example/i.png" }] }
    }, "openai-compatible");
    expect(images).toHaveLength(1);
  });

  it("Google 格式从 inlineData 提取图片", () => {
    const images = extractProviderOutputImages({
      candidates: [{
        content: { parts: [{ text: "图如下" }, { inlineData: { mimeType: "image/png", data: "aGVsbG8=" } }] }
      }]
    }, "google");
    expect(images).toHaveLength(1);
    expect(images[0].source).toBe("data:image/png;base64,aGVsbG8=");
    expect(images[0].mimeType).toBe("image/png");
  });
});

describe("Google Gemini 协议", () => {
  it("非流式归一化：thought part 进 reasoning，正文合并", () => {
    const result = normalizeProviderResponse({
      candidates: [{
        content: {
          parts: [
            { text: "推理中", thought: true },
            { text: "最终回答" }
          ]
        }
      }],
      usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 6, totalTokenCount: 10 }
    }, "google");

    expect(result.reasoning).toBe("推理中");
    expect(result.content).toBe("最终回答");
    expect(result.reasoningKind).toBe("thinking");
    expect(result.usage.inputTokens).toBe(4);
    expect(result.usage.outputTokens).toBe(6);
    expect(result.usage.totalTokens).toBe(10);
  });

});

describe("全模态文件：非流式提取", () => {
  it("extractProviderOutputFiles 从四种协议提取非图片文件", () => {
    expect(extractProviderOutputFiles({
      content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: "JVBERg==" } }]
    }, "anthropic")).toHaveLength(1);
    expect(extractProviderOutputFiles({
      output: [{ type: "audio", data: "U0FNUExF", mime_type: "audio/mpeg" }]
    }, "responses")).toHaveLength(1);
    expect(extractProviderOutputFiles({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: "video/mp4", data: "VklERU8=" } }] } }]
    }, "google")).toHaveLength(1);
    expect(extractProviderOutputFiles({
      choices: [{ message: { content: [{ type: "audio", data: "U0FNUExF", mime_type: "audio/mpeg" }] } }]
    }, "openai-compatible")).toHaveLength(1);
  });

  it("normalizeProviderResponse 的统一载荷包含 files 与 skippedAttachments", () => {
    const normalized = normalizeProviderResponse({
      reasoning: "",
      content: "完成",
      images: [],
      files: [{ name: "voice.mp3", mimeType: "audio/mpeg", source: "data:audio/mpeg;base64,SU1Q", size: 3 }],
      skippedAttachments: [{ name: "doc.pdf", mimeType: "application/pdf", reason: "不支持" }],
      reasoningKind: "thinking",
      usage: null
    });
    expect(normalized.files).toEqual([{ name: "voice.mp3", mimeType: "audio/mpeg", source: "data:audio/mpeg;base64,SU1Q", size: 3 }]);
    expect(normalized.skippedAttachments).toEqual([{ name: "doc.pdf", mimeType: "application/pdf", reason: "不支持" }]);
  });
});
