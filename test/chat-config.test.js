import { describe, it, expect } from "vitest";
import { CHAT_CONFIG_DEFAULTS, resolveChatConfig, normalizeChatConfig, migrateChatSettings, validateChatConfig } from "../src/modules/context/domain/config.js";
import { compressionPrefix, estimateContextTokens, resolveInputBudget, shouldCompressResponse } from "../src/modules/context/domain/budget.js";
import { buildPersistentPayload } from "../src/app/state/persistence.js";
import { createStore } from "../src/app/state/store.js";

describe("聊天配置与项目继承", () => {
  it("显式空提示词覆盖；未覆盖参数随聊天默认值更新", () => {
    const state = { chatConfig: { systemPrompt: "global", temperature: 0.2 }, projects: [{ id: "p", configOverrides: { systemPrompt: "" } }] };
    expect(resolveChatConfig(state, { projectId: "p" })).toMatchObject({ systemPrompt: "", temperature: 0.2 });
    state.chatConfig.temperature = 0.9;
    expect(resolveChatConfig(state, { projectId: "p" }).temperature).toBe(0.9);
    delete state.projects[0].configOverrides.systemPrompt;
    expect(resolveChatConfig(state, { projectId: "p" }).systemPrompt).toBe("global");
  });
  it("会话思考覆盖优先，切换模型不会改变配置；项目移除回归默认", () => {
    const state = { chatConfig: { defaultReasoningEffort: "low" }, projects: [{ id: "p", configOverrides: { defaultReasoningEffort: "high" } }] };
    expect(resolveChatConfig(state, { projectId: "p", model: "x", reasoningEffortOverride: "max" }).reasoningEffort).toBe("max");
    expect(resolveChatConfig(state, { projectId: "missing" }).reasoningEffort).toBe("low");
    expect(resolveChatConfig(state, { projectId: "p", model: "y" }).reasoningEffort).toBe("high");
  });
  it("拒绝非法参数，同时保留零值、false 和空字符串", () => {
    expect(normalizeChatConfig({ temperature: 0, systemPrompt: "", saveChats: false }, true)).toEqual({ temperature: 0, systemPrompt: "", saveChats: false });
    expect(validateChatConfig({ compressionThreshold: 1.5 })).not.toBe("");
    expect(validateChatConfig({ topP: NaN })).not.toBe("");
    expect(normalizeChatConfig({ unknown: 3 }, true)).toEqual({});
  });
  it("迁移重置行为，备份不含凭据，二次迁移不重置用户配置", () => {
    const source = { providers: [{ id: "p", systemPrompt: "old", apiKey: "secret", modelOverrides: { m: { topP: 0.1, apiKey: "secret" } } }] };
    const migrated = migrateChatSettings(source);
    expect(migrated.chatConfig).toEqual(CHAT_CONFIG_DEFAULTS);
    expect(JSON.stringify(migrated.legacySettingsBackup)).not.toContain("secret");
    expect(migrated.legacySettingsBackup.providers[0].systemPrompt).toBe("old");
    expect(migrateChatSettings({ ...migrated, chatConfig: { systemPrompt: "new" } }).chatConfig.systemPrompt).toBe("new");
  });
  it("新会话使用项目保存偏好，旧会话保留原保存状态", () => {
    const store = createStore();
    store.state.chatConfig.saveChats = false;
    const temporary = store.createConversation({ silent: true });
    store.state.chatConfig.saveChats = true;
    const saved = store.createConversation({ silent: true });
    expect(temporary.saveChats).toBe(false);
    expect(buildPersistentPayload(store.state).conversations.map((c) => c.id)).toEqual([saved.id]);
  });
});
describe("上下文预算", () => {
  it("预算扣除输出和安全余量，冲突不静默钳制", () => {
    expect(resolveInputBudget({ contextWindow: 10000, maxTokens: 1000 }, { inputBudget: null })).toBe(8500);
    expect(() => resolveInputBudget({ contextWindow: 100, maxTokens: 100 }, {})).toThrow();
    // 用户要求预算始终自动计算，旧手动预算不再生效。
    expect(resolveInputBudget({ contextWindow: 10000, maxTokens: 1000 }, { inputBudget: 9000 })).toBe(8500);
  });
  it("按用户轮次切分，保留工具组和待发送消息", () => {
    const messages = [ { role: "user", id: "u1" }, { role: "assistant", id: "a1", parts: [{ type: "tool_call" }, { type: "tool_result" }] }, { role: "user", id: "u2" }, { role: "assistant", id: "a2" }, { role: "user", id: "u3" } ];
    expect(compressionPrefix(messages, true).map((m) => m.id)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(compressionPrefix(messages).map((m) => m.id)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(compressionPrefix(messages.slice(0, 4))).toEqual(messages.slice(0, 4));
    expect(compressionPrefix([{ role: "user" }], true)).toEqual([]);
    expect(compressionPrefix([])).toEqual([]);
    const toolTurn = [...messages, { role: "assistant", tool_calls: [{ id: "call" }] }, { role: "tool", tool_call_id: "call" }];
    expect(compressionPrefix(toolTurn)).toEqual(messages.slice(0, 4));
    expect(compressionPrefix([...messages.slice(0, 2), { noticeKind: "context-compress" }])).toEqual(messages.slice(0, 2));
  });
  it("图片和二进制附件采用保守估算", () => {
    expect(estimateContextTokens({ type: "image", source: "data:image/png;base64,abc" })).toBeGreaterThanOrEqual(4096);
    expect(estimateContextTokens({ type: "file", size: 20000, source: "data:abc" })).toBeGreaterThanOrEqual(10000);
  });
});

it("本机迁移恢复不保存状态与旧思考来源，二次启动保留新设置", async () => {
  const { loadPersistedState } = await import("../src/app/state/persistence.js");
  localStorage.clear();
  localStorage.setItem("tribblebook-v6-state", JSON.stringify({ providers: [null, { id: "p", saveChats: false }], conversations: [{ id: "c", providerId: "p", reasoningEffort: "max", messages: [] }] }));
  const migrated = await loadPersistedState();
  expect(migrated.conversations[0]).toMatchObject({ saveChats: false, reasoningEffortOverride: null });
  expect(buildPersistentPayload(migrated).conversations).toEqual([]);
  expect(migrated.legacySettingsBackup.conversations[0].reasoningEffort).toBe("max");
});
it("摘要只在当前分支边界有效，编辑早期内容会失效", async () => {
  const { getValidContextCompression, invalidateCompressionForIndex } = await import("../src/app/state/store.js");
  const { normalizeConversation } = await import("../src/contracts/normalize.js");
  const c = normalizeConversation({ messages: [{ id: "u", role: "user", content: "a" }, { id: "a", role: "assistant", content: "b" }], contextCompression: { summary: "summary", throughMessageId: "a" } });
  expect(getValidContextCompression(c)?.boundaryIndex).toBe(1);
  expect(invalidateCompressionForIndex(c, 0)).toBe(true);
  expect(getValidContextCompression(c)).toBeNull();
  c.contextCompression = { summary: "other branch", throughMessageId: "missing" };
  expect(getValidContextCompression(c)).toBeNull();
});

it("损坏的备份条目不妨碍恢复其他设置", () => {
  const result = migrateChatSettings({ settingsSchemaVersion: 1, chatConfig: { systemPrompt: "保留" }, legacySettingsBackup: { providers: [null, false, { id: "p", systemPrompt: "旧提示" }], conversations: "invalid" } });
  expect(result.chatConfig.systemPrompt).toBe("保留");
  expect(result.legacySettingsBackup.providers).toHaveLength(1);
  expect(result.legacySettingsBackup.conversations).toEqual([]);
});

it("旧轮数配置被移除，聊天及项目的其他设置继续生效", () => {
  const source = { settingsSchemaVersion: 1, chatConfig: { keepRecentTurns: 6, temperature: 0.2 } };
  expect(migrateChatSettings(source).chatConfig).not.toHaveProperty("keepRecentTurns");
  expect(normalizeChatConfig({ keepRecentTurns: 2, systemPrompt: "" }, true)).toEqual({ systemPrompt: "" });
  const config = resolveChatConfig({ ...source, projects: [{ id: "p", configOverrides: { keepRecentTurns: 100, systemPrompt: "项目" } }] }, { projectId: "p" });
  expect(config).not.toHaveProperty("keepRecentTurns");
  expect(config).toMatchObject({ temperature: 0.2, systemPrompt: "项目" });
});

it("结束触发阈值含等号，停止、错误和未结束均不触发", () => {
  expect(shouldCompressResponse({ completed: true }, 799, 1000, 80)).toBe(false);
  expect(shouldCompressResponse({ completed: true }, 800, 1000, 80)).toBe(true);
  expect(shouldCompressResponse({ completed: true }, 801, 1000, 80)).toBe(true);
  for (const result of [{ completed: false }, { completed: true, stopped: true }, { completed: true, error: "失败" }]) expect(shouldCompressResponse(result, 900, 1000, 80)).toBe(false);
});
