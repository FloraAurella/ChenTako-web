import { contextMessages } from '../src/modules/chat/domain/queries.js';
import { estimateContextTokens } from '../src/modules/context/domain/budget.js';
import { describe, expect, it } from "vitest";
import { computeContextUsage } from "../src/modules/context/services/context-usage.js";
import { LIMITS } from "../src/contracts/constants.js";

function makeConversation(messages, contextCompression = null) {
  // 线性链：activeRootMessageId + activeChildByMessageId 与存储层一致
  messages.forEach((message, index) => {
    message.parentId = index ? String(messages[index - 1].id) : null;
  });
  return {
    messages,
    activeRootMessageId: messages[0]?.id || "",
    activeChildByMessageId: Object.fromEntries(messages.slice(0, -1).map((message, index) => [message.id, messages[index + 1].id])),
    contextCompression
  };
}

function userMessage(id, content) {
  return { id, role: "user", content, files: [], parts: [] };
}

function assistantMessage(id, content, usage = null) {
  return { id, role: "assistant", content, files: [], parts: [], ...(usage ? { usage } : {}) };
}

describe("computeContextUsage", () => {
  const window = 10000;

  it("未压缩：输入按字符估算，输出优先用真实 usage", () => {
    const chars = LIMITS.estimateCharsPerToken * 100; // 100 tok
    const conversation = makeConversation([
      userMessage("u1", "a".repeat(chars)),
      assistantMessage("a1", "", { outputTokens: 240, estimated: false })
    ]);
    const usage = computeContextUsage(conversation, window);
    expect(usage.inputTokens).toBe(100);
    expect(usage.outputTokens).toBe(240);
    expect(usage.used).toBe(340);
    expect(usage.remaining).toBe(window - 340);
    expect(usage.percent).toBeCloseTo(0.034);
    expect(usage.compressed).toBe(false);
    expect(usage.approximateOutput).toBe(false);
  });

  it("最新助手消息有真实 totalTokens 时，圆环与消息脚注使用同一个数值", () => {
    const conversation = makeConversation([
      userMessage("u1", "请介绍一下你自己"),
      assistantMessage("a1", "很长但不应再按字符重算的回答".repeat(20), {
        inputTokens: 84,
        outputTokens: 233,
        totalTokens: 317,
        estimated: false
      })
    ]);
    const usage = computeContextUsage(conversation, window);
    expect(usage.used).toBe(317);
    expect(usage.inputTokens).toBe(84);
    expect(usage.outputTokens).toBe(233);
    expect(usage.approximate).toBe(false);
  });

  it("真实 usage 快照之后只估算新增消息，下一次真实 usage 到达前不重复历史", () => {
    const chars = LIMITS.estimateCharsPerToken;
    const conversation = makeConversation([
      userMessage("u1", "旧问题"),
      assistantMessage("a1", "旧回答", {
        inputTokens: 84,
        outputTokens: 233,
        totalTokens: 317,
        estimated: false
      }),
      userMessage("u2", "u".repeat(chars * 10)),
      assistantMessage("a2", "a".repeat(chars * 5))
    ]);
    const usage = computeContextUsage(conversation, window);
    expect(usage.used).toBe(332);
    expect(usage.approximateInput).toBe(true);
    expect(usage.approximateOutput).toBe(true);
    expect(usage.approximate).toBe(true);
  });

  it("压缩后：只统计摘要 + 压缩点之后的消息，替代历史不重复计入", () => {
    const oldChars = LIMITS.estimateCharsPerToken * 500; // 已被摘要替代的 500 tok
    const newChars = LIMITS.estimateCharsPerToken * 60; // 压缩点之后 60 tok
    const compression = {
      summary: "s".repeat(LIMITS.estimateCharsPerToken * 80), // 摘要 80 tok
      throughMessageId: "a1",
      sourceMessageCount: 2
    };
    const conversation = makeConversation([
      userMessage("u1", "b".repeat(oldChars)),
      assistantMessage("a1", "b".repeat(oldChars)),
      userMessage("u2", "c".repeat(newChars)),
      assistantMessage("a2", "")
    ], compression);
    const usage = computeContextUsage(conversation, window);
    // 不再把 u1/a1 与摘要同时计入
    expect(usage.inputTokens).toBe(60);
    expect(usage.summaryTokens).toBe(80);
    expect(usage.used).toBe(140);
    expect(usage.compressed).toBe(true);
    expect(usage.compressedCount).toBe(2);
  });

  it("压缩后的真实 usage 已含摘要，不再把摘要估算值重复相加", () => {
    const compression = {
      summary: "s".repeat(LIMITS.estimateCharsPerToken * 80),
      throughMessageId: "a1",
      sourceMessageCount: 2
    };
    const conversation = makeConversation([
      userMessage("u1", "旧问题"),
      assistantMessage("a1", "旧回答"),
      userMessage("u2", "压缩后的问题"),
      assistantMessage("a2", "压缩后的回答", {
        inputTokens: 170,
        outputTokens: 52,
        totalTokens: 222,
        estimated: false
      })
    ], compression);
    const usage = computeContextUsage(conversation, window);
    expect(usage.used).toBe(222);
    expect(usage.summaryTokens).toBe(0);
    expect(usage.compressed).toBe(true);
    expect(usage.approximate).toBe(false);
  });

  it("百分比与剩余量夹在 0–100%", () => {
    const chars = LIMITS.estimateCharsPerToken * 20000; // 远超窗口
    const conversation = makeConversation([userMessage("u1", "d".repeat(chars))]);
    const usage = computeContextUsage(conversation, window);
    expect(usage.percent).toBe(1);
    expect(usage.remaining).toBe(0);
  });

  it("系统提示（noticeKind）不计入用量", () => {
    const chars = LIMITS.estimateCharsPerToken * 50;
    const conversation = makeConversation([
      userMessage("u1", "e".repeat(chars)),
      { id: "n1", role: "assistant", content: "x".repeat(chars), noticeKind: "context-compress", files: [], parts: [] }
    ]);
    const usage = computeContextUsage(conversation, window);
    expect(usage.used).toBe(50);
  });

  it("estimated 输出视为估算字符数", () => {
    const chars = LIMITS.estimateCharsPerToken * 30;
    const conversation = makeConversation([
      userMessage("u1", "hi"),
      assistantMessage("a1", "f".repeat(chars), { outputTokens: 999, estimated: true })
    ]);
    const usage = computeContextUsage(conversation, window);
    expect(usage.outputTokens).toBe(30);
    expect(usage.approximateOutput).toBe(true);
  });
});

it("圆环与压缩触发使用相同消息字段，不把 ID、时间与思考计入请求预算", () => {
  const c = { messages: [{ id: 'u', role: 'user', content: '要求', createdAt: 99 }, { id: 'a', role: 'assistant', content: '回答', reasoning: '内部思考'.repeat(500), createdAt: 100 }] };
  const config = { systemPrompt: '规则' }; const extensions = { tools: [], skills: [] };
  const usage = computeContextUsage(c, 10000, { config, fixedContext: '资料', maxTokens: 1000, extensions });
  expect(usage.used).toBe(estimateContextTokens({ systemPrompt: '规则资料', contextSummary: '', messages: contextMessages(c), extensions }));
});
