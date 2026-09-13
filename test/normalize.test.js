"use strict";

import { describe, it, expect } from "vitest";
import {
  normalizeProvider,
  normalizeConversation,
  normalizeMessage,
  normalizeMessageUsage,
  normalizeOutputImages,
  normalizeOutputFiles,
  normalizeModelCapabilities,
  isSafeImageSource,
  isSafeFileSource,
  snapshotProvider,
  createId
} from "../src/contracts/normalize.js";

const PNG = "data:image/png;base64,aGVsbG8=";

describe("isSafeImageSource", () => {
  it("放行 data:image png/jpeg/webp/gif", () => {
    expect(isSafeImageSource(PNG)).toBe(true);
    expect(isSafeImageSource("data:image/jpeg;base64,aGk=")).toBe(true);
    expect(isSafeImageSource("data:image/webp;base64,aGk=")).toBe(true);
    expect(isSafeImageSource("data:image/gif;base64,aGk=")).toBe(true);
  });

  it("放行 https 与回环 http，拒绝其它", () => {
    expect(isSafeImageSource("https://example.com/a.png")).toBe(true);
    expect(isSafeImageSource("http://127.0.0.1:3000/a.png")).toBe(true);
    expect(isSafeImageSource("http://localhost/a.png")).toBe(true);
    expect(isSafeImageSource("http://example.com/a.png")).toBe(false);
    expect(isSafeImageSource("data:image/svg+xml;base64,aGk=")).toBe(false);
    expect(isSafeImageSource("javascript:alert(1)")).toBe(false);
    expect(isSafeImageSource("")).toBe(false);
  });
});

describe("normalizeModelCapabilities", () => {
  it("三态归一：true/false/其它为 auto", () => {
    expect(normalizeModelCapabilities({ visionInput: true })).toEqual({ visionInput: true, imageOutput: "auto" });
    expect(normalizeModelCapabilities({ visionInput: false, imageOutput: false })).toEqual({ visionInput: false, imageOutput: false });
    expect(normalizeModelCapabilities({ visionInput: "yes" }).visionInput).toBe("auto");
    expect(normalizeModelCapabilities(null)).toEqual({ visionInput: "auto", imageOutput: "auto" });
  });
});

describe("normalizeProvider", () => {
  it("归一模型列表与默认模型", () => {
    const provider = normalizeProvider({
      displayName: "测试",
      baseUrl: "https://api.test.com/v1/",
      responseFormat: "anthropic",
      models: ["b", "a", "b", ""],
      defaultModel: "c",
      maxTokens: 999999999,
      contextWindow: -5,
      temperature: 9
    });
    expect(provider.models).toEqual(["b", "a"]);
    expect(provider.defaultModel).toBe("b");
    expect(provider.baseUrl).toBe("https://api.test.com/v1");
    expect(provider.responseFormat).toBe("anthropic");
    expect(provider.maxTokens).toBeLessThanOrEqual(1000000);
    expect(provider.contextWindow).toBeGreaterThan(0);
    expect(provider.temperature).toBeLessThanOrEqual(2);
    expect(provider.streaming).toBe(true);
    expect(provider.saveChats).toBe(true);
  });

  it("未知 responseFormat 回退 openai-compatible", () => {
    expect(normalizeProvider({ responseFormat: "weird" }).responseFormat).toBe("openai-compatible");
  });

  it("每个模型获得能力三态", () => {
    const provider = normalizeProvider({
      models: ["m1"],
      modelCapabilities: { m1: { visionInput: true } }
    });
    expect(provider.modelCapabilities.m1).toEqual({ visionInput: true, imageOutput: "auto" });
  });

  it("保留供应商的新会话默认思考档位", () => {
    expect(normalizeProvider({ defaultReasoningEffort: "low" }).defaultReasoningEffort).toBe("low");
    expect(normalizeProvider({ defaultReasoningEffort: "unknown" }).defaultReasoningEffort).toBe("");
  });

  it("旧供应商默认启用并补齐空模型覆盖", () => {
    const provider = normalizeProvider({ models: ["m1"] });
    expect(provider.enabled).toBe(true);
    expect(provider.modelOverrides).toEqual({});
  });

  it("只保留模型列表中存在且合法的覆盖", () => {
    const provider = normalizeProvider({
      models: ["m1"],
      modelOverrides: {
        m1: { maxTokens: 2048, temperature: 0.2 },
        removed: { maxTokens: 4096 }
      }
    });
    expect(provider.modelOverrides).toEqual({ m1: { maxTokens: 2048, temperature: 0.2 } });
  });
});

describe("snapshotProvider", () => {
  it("只读快照仅保留连接字段", () => {
    const snapshot = snapshotProvider({
      displayName: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      responseFormat: "responses",
      defaultModel: "chat",
      contextWindow: 131072,
      maxTokens: 8192,
      apiKey: "secret",
      systemPrompt: "should not appear as key storage"
    });
    expect(snapshot.displayName).toBe("DeepSeek");
    expect(snapshot.responseFormat).toBe("responses");
    expect(snapshot.contextWindow).toBe(131072);
    expect(Object.keys(snapshot)).not.toContain("apiKey");
    expect(Object.keys(snapshot)).not.toContain("systemPrompt");
  });
});

describe("normalizeMessageUsage", () => {
  it("归一 token 数并过滤空 usage", () => {
    expect(normalizeMessageUsage({ inputTokens: 10, outputTokens: 5 })).toEqual({
      inputTokens: 10, outputTokens: 5, totalTokens: 15, estimated: false
    });
    expect(normalizeMessageUsage({ inputTokens: 0, outputTokens: 0 })).toBeNull();
    expect(normalizeMessageUsage(null)).toBeNull();
  });
});

describe("normalizeOutputImages", () => {
  it("限额过滤：单条最多 4 张、不安全来源剔除", () => {
    const images = normalizeOutputImages([
      { source: PNG },
      { source: "https://a.example/1.png" },
      { source: "http://evil.example/2.png" },
      { source: PNG },
      { source: PNG },
      { source: PNG }
    ]);
    expect(images).toHaveLength(4);
    expect(images.every((image) => isSafeImageSource(image.source))).toBe(true);
  });

  it("补全 mimeType 与 alt", () => {
    const [image] = normalizeOutputImages([{ source: PNG }]);
    expect(image.mimeType).toBe("image/png");
    expect(image.alt).toBeTruthy();
  });
});

describe("normalizeMessage / normalizeConversation", () => {
  it("角色过滤与字段规范化", () => {
    const message = normalizeMessage({ role: "system", content: "x" });
    expect(message.role).toBe("user");
    const assistant = normalizeMessage({
      role: "assistant",
      content: "答案",
      reasoning: "推理",
      reasoningKind: "summary",
      usage: { inputTokens: 1, outputTokens: 2 },
      parts: [{ type: "video", source: "reserved" }]
    });
    expect(assistant.reasoningKind).toBe("summary");
    expect(assistant.parts[0].type).toBe("video");
    expect(assistant.usage.totalTokens).toBe(3);
  });

  it("思考时长 reasoningMs 归一：数字字符串保留，非法值回退 0", () => {
    const kept = normalizeMessage({ role: "assistant", content: "答案", reasoningMs: "4200" });
    expect(kept.reasoningMs).toBe(4200);
    const clamped = normalizeMessage({ role: "assistant", content: "答案", reasoningMs: -5 });
    expect(clamped.reasoningMs).toBe(0);
    const fallback = normalizeMessage({ role: "assistant", content: "答案" });
    expect(fallback.reasoningMs).toBe(0);
  });

  it("压缩提示字段归一：noticeKind / noticeState 白名单", () => {
    const notice = normalizeMessage({ role: "assistant", noticeKind: "context-compress", noticeState: "running" });
    expect(notice.noticeKind).toBe("context-compress");
    expect(notice.noticeState).toBe("running");
    const done = normalizeMessage({ role: "assistant", noticeKind: "context-compress", noticeState: "done" });
    expect(done.noticeState).toBe("done");
    const rejected = normalizeMessage({ role: "assistant", content: "普通回复", noticeKind: "hack", noticeState: "weird" });
    expect(rejected.noticeKind).toBe("");
    expect(rejected.noticeState).toBe("");
  });

  it("Tool 结果部件会收窄为可持久化的执行记录", () => {
    const message = normalizeMessage({
      role: "assistant",
      parts: [{
        type: "tool_result",
        callId: "call-1",
        name: "weather_lookup",
        source: "tool",
        status: "succeeded",
        input: '{"city":"上海"}',
        output: "晴",
        contentOffset: 18,
        durationMs: 123
      }]
    });
    expect(message.parts[0]).toMatchObject({
      type: "tool_result",
      name: "weather_lookup",
      source: "tool",
      status: "succeeded",
      contentOffset: 18,
      durationMs: 123
    });
  });

  it("把改名前的内置工具名迁移到 ChenTako 命名空间", () => {
    const message = normalizeMessage({
      role: "assistant",
      parts: [
        { type: "tool_result", name: "tribblebook_run_command", status: "succeeded" },
        { type: "tool_result", name: "tribblebook_code_interpreter", status: "succeeded" }
      ]
    });
    expect(message.parts.map((part) => part.name)).toEqual([
      "clawbox_run_command",
      "clawbox_code_interpreter"
    ]);
  });

  it("结构化运行时结果提取图片并保留 Skill / 沙箱来源", () => {
    const message = normalizeMessage({
      role: "assistant",
      parts: [
        {
          type: "tool_result",
          name: "render_chart",
          source: "sandbox",
          status: "succeeded",
          content: [
            { type: "json", json: { ok: true } },
            { type: "image", data: "eHg=", mime_type: "image/png", alt: "图表" }
          ]
        },
        { type: "skill_applied", name: "代码审查" }
      ]
    });
    expect(message.parts[0]).toMatchObject({ source: "sandbox", content: [{ type: "json" }] });
    expect(message.parts[1]).toMatchObject({ type: "image", source: "data:image/png;base64,eHg=" });
    expect(message.parts[2]).toMatchObject({ type: "skill_applied", source: "skill", status: "applied" });
  });

  it("运行时文件保留正文锚点与产物标识，旧普通文件不伪造锚点", () => {
    const message = normalizeMessage({ role: "assistant", parts: [
      {
        type: "file",
        name: "preview.svg",
        mimeType: "image/svg+xml",
        source: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        size: 11,
        contentOffset: 24,
        artifactId: "call-svg:0",
        callId: "call-svg"
      },
      {
        type: "file",
        name: "plain.txt",
        mimeType: "text/plain",
        source: "data:text/plain;base64,b2s=",
        size: 2
      }
    ] });

    expect(message.parts[0]).toMatchObject({ contentOffset: 24, artifactId: "call-svg:0", callId: "call-svg" });
    expect(message.parts[1]).not.toHaveProperty("contentOffset");
  });

  it("多 Skill 与连续工具回合不会在归档归一化时截掉完成结果", () => {
    const runtimeParts = Array.from({ length: 40 }, (_, index) => ({
      type: index < 16 ? "skill_applied" : "tool_result",
      name: `runtime-${index}`,
      source: index < 16 ? "skill" : "tool",
      status: index < 16 ? "applied" : "succeeded",
      output: index < 16 ? "" : `result-${index}`
    }));
    const message = normalizeMessage({ role: "assistant", parts: runtimeParts });

    expect(message.parts).toHaveLength(40);
    expect(message.parts.at(-1)).toMatchObject({ name: "runtime-39", status: "succeeded" });
  });

  it("会话归一：非法思考强度回退 medium，压缩缺失字段清除", () => {
    const conversation = normalizeConversation({
      title: "  标题  ",
      reasoningEffort: "ultra",
      messages: [{ role: "user", content: "hi" }],
      contextCompression: { summary: "" },
      draft: "草稿"
    });
    expect(conversation.title).toBe("标题");
    expect(conversation.reasoningEffort).toBe("medium");
    expect(conversation.messages).toHaveLength(1);
    expect(conversation.contextCompression).toBeNull();
    expect(conversation.draft).toBe("草稿");
  });

  it("会话归一：历史 none 档回落到最低档 low", () => {
    const conversation = normalizeConversation({
      reasoningEffort: "none",
      messages: [{ role: "user", content: "hi" }]
    });
    expect(conversation.reasoningEffort).toBe("low");
  });

  it("会话归一：扩展选择按类别去重保存", () => {
    const conversation = normalizeConversation({
      extensionSelection: { tools: ["weather", "weather"], skills: ["review"], sandbox: true }
    });
    expect(conversation.extensionSelection).toEqual({ tools: ["weather"], skills: ["review"], sandbox: true });
  });

  it("会话归一：旧线性消息自动补齐父子关系与活动选择", () => {
    const conversation = normalizeConversation({
      messages: [
        { id: "u1", role: "user", content: "一" },
        { id: "a1", role: "assistant", content: "二" }
      ]
    });
    expect(conversation.activeRootMessageId).toBe("u1");
    expect(conversation.activeChildByMessageId).toEqual({ u1: "a1" });
    expect(conversation.messages.map((message) => message.parentId)).toEqual([null, "u1"]);
  });

  it("会话归一：保留合法分支选择，修复悬空父节点", () => {
    const conversation = normalizeConversation({
      activeRootMessageId: "u1b",
      activeChildByMessageId: { a1: "u1b" },
      messages: [
        { id: "u1", role: "user", content: "一", parentId: null },
        { id: "a1", role: "assistant", content: "二", parentId: "u1" },
        { id: "u1b", role: "user", content: "一改", parentId: "a1" },
        { id: "a1b", role: "assistant", content: "三", parentId: "missing" }
      ]
    });
    expect(conversation.activeRootMessageId).toBe("u1");
    expect(conversation.messages.at(-1).parentId).toBe("u1b");
    expect(conversation.activeChildByMessageId.a1).toBe("u1b");
  });

  it("会话归一：重复 ID 会确定性回退为可访问的线性路径", () => {
    const conversation = normalizeConversation({
      messages: [
        { id: "m1", role: "user", content: "一" },
        { id: "m2", role: "assistant", content: "二" },
        { id: "m2", role: "user", content: "三" },
        { id: "m4", role: "assistant", content: "四" }
      ]
    });
    expect(new Set(conversation.messages.map((message) => message.id)).size).toBe(4);
    expect(conversation.messages.map((message) => message.parentId)).toEqual([
      null,
      conversation.messages[0].id,
      conversation.messages[1].id,
      conversation.messages[2].id
    ]);
    expect(conversation.activeRootMessageId).toBe(conversation.messages[0].id);
  });

  it("部分缺失 parentId 的树回退为旧版线性顺序", () => {
    const conversation = normalizeConversation({
      messages: [
        { id: "m1", role: "user", content: "一", parentId: null },
        { id: "m2", role: "assistant", content: "二" },
        { id: "m3", role: "user", content: "三", parentId: "m2" }
      ]
    });
    expect(conversation.messages.map((message) => message.parentId)).toEqual([null, "m1", "m2"]);
  });

  it("活动选择映射使用无原型字典，原型键消息 ID 不会污染对象", () => {
    const conversation = normalizeConversation({
      messages: [
        { id: "__proto__", role: "user", content: "一" },
        { id: "constructor", role: "assistant", content: "二" }
      ]
    });
    expect(Object.getPrototypeOf(conversation.activeChildByMessageId)).toBeNull();
    expect(conversation.activeChildByMessageId["__proto__"]).toBe("constructor");
    expect({}.polluted).toBeUndefined();
  });

  it("createId 返回非空字符串", () => {
    expect(typeof createId()).toBe("string");
    expect(createId().length).toBeGreaterThan(5);
  });
});

describe("normalizeOutputFiles / file part", () => {
  const AUDIO = "data:audio/mpeg;base64,SU1Q";

  it("归一化模型输出文件并补齐默认字段", () => {
    const files = normalizeOutputFiles([
      { name: "voice.mp3", mimeType: "audio/mpeg", source: AUDIO, size: 3 },
      { name: "bad.bin", mimeType: "application/octet-stream", source: "javascript:alert(1)" }
    ]);
    expect(files).toEqual([{ type: "file", name: "voice.mp3", mimeType: "audio/mpeg", source: AUDIO, size: 3 }]);
  });

  it("单条最多保留 8 个文件，单个 20MB、合计 80MB 封顶", () => {
    const one = "data:audio/mpeg;base64," + "a".repeat(4096);
    const nine = Array.from({ length: 9 }, (_, index) => ({ name: `${index}.mp3`, mimeType: "audio/mpeg", source: one }));
    expect(normalizeOutputFiles(nine).length).toBe(8);
    const oversized = [{ name: "big.pdf", mimeType: "application/pdf", source: "data:application/pdf;base64," + "a".repeat(Math.ceil((21 * 1024 * 1024) * 4 / 3)) }];
    expect(normalizeOutputFiles(oversized)).toEqual([]);
  });

  it("同名同源运行时文件去重并优先保留带正文锚点的副本", () => {
    const source = "data:text/html;base64,PGgxPk9LPC9oMT4=";
    const files = normalizeOutputFiles([
      { name: "demo.html", mimeType: "text/html", source, size: 11, contentOffset: 18, artifactId: "call-1:0" },
      { name: "demo.html", mimeType: "text/html", source, size: 11 }
    ]);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ contentOffset: 18, artifactId: "call-1:0" });
  });

  it("normalizeParts 校验 file part 并通过限额", () => {
    const message = normalizeMessage({
      role: "user",
      content: "看这个",
      parts: [
        { type: "file", name: "voice.mp3", mimeType: "audio/mpeg", source: AUDIO, size: 3 },
        { type: "file", name: "bad.bin", mimeType: "application/octet-stream", source: "javascript:alert(1)" },
        { type: "image", source: PNG, mimeType: "image/png" }
      ]
    });
    const fileParts = message.parts.filter((part) => part.type === "file");
    expect(fileParts).toEqual([{ type: "file", name: "voice.mp3", mimeType: "audio/mpeg", source: AUDIO, size: 3 }]);
  });

  it("skippedAttachments 被归一化", () => {
    const message = normalizeMessage({
      role: "user",
      content: "看这份 PDF",
      skippedAttachments: [{ name: "doc.pdf", mimeType: "application/pdf", reason: "当前供应商不支持该文件格式" }]
    });
    expect(message.skippedAttachments).toEqual([
      { name: "doc.pdf", mimeType: "application/pdf", reason: "当前供应商不支持该文件格式" }
    ]);
  });

  it("isSafeFileSource 放行任意 mime 的 data URL 与 https，拒绝 javascript", () => {
    expect(isSafeFileSource(AUDIO)).toBe(true);
    expect(isSafeFileSource("data:application/pdf;base64,JVBERg==")).toBe(true);
    expect(isSafeFileSource("data:video/mp4;base64,aGk=")).toBe(true);
    expect(isSafeFileSource("https://example.com/f.pdf")).toBe(true);
    expect(isSafeFileSource("http://127.0.0.1:3000/f.pdf")).toBe(true);
    expect(isSafeFileSource("javascript:alert(1)")).toBe(false);
  });
});
