"use strict";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  createSafeStorage,
  createStateArchive,
  evictLegacyStorage,
  safeStringify,
  readUiPreferences,
  writeUiPreferences,
  readAppMode,
  writeAppMode,
  buildPersistentPayload,
  buildLightweightPayload,
  loadPersistedState
} from "../src/app/state/persistence.js";
import { createStore } from "../src/app/state/store.js";
import { STORAGE_KEYS } from "../src/contracts/constants.js";
import { normalizeConversation, normalizeProvider } from "../src/contracts/normalize.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createSafeStorage", () => {
  it("常规读写删除", () => {
    const storage = createSafeStorage();
    storage.setItem("k", "v");
    expect(storage.getItem("k")).toBe("v");
    storage.removeItem("k");
    expect(storage.getItem("k")).toBeNull();
  });

  it("真实写入失败时保留内存副本，读取仍返回本次会话的值", () => {
    const setItemSpy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });
    try {
      const storage = createSafeStorage();
      storage.setItem("state", "{\"providers\":[]}");
      expect(storage.getItem("state")).toBe("{\"providers\":[]}");
      expect(storage.isDegraded()).toBe(true);
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it("真实写入失败后自动清理遗留项目键并重试成功（配额自愈）", () => {
    localStorage.clear();
    localStorage.setItem("kotoba-old-key", "junk");
    localStorage.setItem("perabox-ui-preferences-v1", "junk");
    localStorage.setItem("ai-chatbox-structure-state-v1", "junk");
    localStorage.setItem(STORAGE_KEYS.state, "keep-me");
    // 模拟配额被遗留键挤占：只要遗留键还在，除探针外的一切写入都失败
    const realSetItem = localStorage.setItem.bind(localStorage);
    const setItemSpy = vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      const quotaBlocked = localStorage.getItem("kotoba-old-key") !== null;
      if (quotaBlocked && key !== "__clawbox_probe__") {
        throw new DOMException("QuotaExceededError", "QuotaExceededError");
      }
      realSetItem(key, value);
    });
    try {
      const storage = createSafeStorage();
      storage.setItem(STORAGE_KEYS.state, "{\"providers\":[1]}");
      // 首次写入触发遗留键清理 + 重试：磁盘写入恢复健康
      expect(storage.isDegraded()).toBe(false);
      expect(localStorage.getItem("kotoba-old-key")).toBeNull();
      expect(localStorage.getItem("perabox-ui-preferences-v1")).toBeNull();
      expect(localStorage.getItem("ai-chatbox-structure-state-v1")).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.state)).toBe("{\"providers\":[1]}");
    } finally {
      setItemSpy.mockRestore();
      localStorage.clear();
    }
  });
});

describe("evictLegacyStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("只删除前身项目命名空间，保留当前键", () => {
    localStorage.setItem("ai-chatbox-structure-state-v1", "1");
    localStorage.setItem("kotoba-app-mode", "2");
    localStorage.setItem("perabox-background-v1", "3");
    localStorage.setItem("tribblebook-v6-state", "4");
    localStorage.setItem("unrelated", "5");
    const removed = evictLegacyStorage(localStorage);
    expect(removed).toBe(3);
    expect(localStorage.getItem("tribblebook-v6-state")).toBe("4");
    expect(localStorage.getItem("unrelated")).toBe("5");
  });
});

describe("safeStringify", () => {
  it("循环引用不抛错，产出可解析的 JSON", () => {
    const node = { name: "root" };
    node.self = node;
    const text = safeStringify({ provider: node, count: 1n });
    const parsed = JSON.parse(text);
    expect(parsed.provider.name).toBe("root");
    expect(parsed.provider.self).toBe("[circular]");
    expect(parsed.count).toBe("1");
  });

  it("常规对象与 JSON.stringify 等价", () => {
    const value = { a: [1, 2], b: { c: "x" } };
    expect(safeStringify(value)).toBe(JSON.stringify(value));
  });
});

describe("createStateArchive", () => {
  function failingIndexedDb() {
    return {
      open: vi.fn(() => {
        const request = {};
        queueMicrotask(() => {
          Object.defineProperty(request, "error", { value: new Error("database unavailable") });
          request.onerror?.();
        });
        return request;
      })
    };
  }

  function hangingIndexedDb() {
    // open 请求永远不回调：模拟数据库损坏或被其他窗口无限期阻塞
    return { open: vi.fn(() => ({}) ) };
  }

  it("数据库打开失败会拒绝当前任务，且不会永久锁死后续保存", async () => {
    const indexedDb = failingIndexedDb();
    vi.stubGlobal("indexedDB", indexedDb);
    vi.stubGlobal("IDBKeyRange", {});
    const archive = createStateArchive();

    await expect(archive.save({ sequence: 1 })).rejects.toThrow("database unavailable");
    await expect(archive.save({ sequence: 2 })).rejects.toThrow("database unavailable");
    expect(indexedDb.open).toHaveBeenCalledTimes(2);
  });

  it("数据库恢复后队列继续写入，加载可读到最新载荷", async () => {
    vi.stubGlobal("indexedDB", failingIndexedDb());
    vi.stubGlobal("IDBKeyRange", {});
    const archive = createStateArchive();
    await expect(archive.save({ sequence: 1 })).rejects.toThrow("database unavailable");

    // 数据库恢复（例如存储故障消除、应用重启后）：同一归档实例应能继续写入。
    vi.stubGlobal("indexedDB", new IDBFactory());
    await archive.save({ sequence: 2 });
    const loaded = await archive.load();
    expect(loaded).toEqual({ sequence: 2 });
  });

  it("open 请求挂死时超时拒绝，加载回退 localStorage", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("indexedDB", hangingIndexedDb());
      vi.stubGlobal("IDBKeyRange", {});
      localStorage.setItem(STORAGE_KEYS.state, JSON.stringify({
        providers: [{ id: "p1", displayName: "回退供应商", baseUrl: "https://p.example" }],
        activeProviderId: "p1"
      }));
      const archive = createStateArchive({ openTimeoutMs: 500 });
      const savePromise = archive.save({ sequence: 1 });
      // 先挂上拒绝断言，再推进假时钟，避免拒绝在无监听窗口期触发
      const saveAssertion = expect(savePromise).rejects.toThrow("IndexedDB 打开超时");
      const loadPromise = loadPersistedState();
      // loadPersistedState 内部使用默认 4000ms 超时；一次推进覆盖两个定时器
      await vi.advanceTimersByTimeAsync(4500);
      await saveAssertion;
      // 加载侧：超时后回退 localStorage，应用得以正常启动
      const loaded = await loadPromise;
      expect(loaded.providers[0].displayName).toBe("回退供应商");
    } finally {
      vi.useRealTimers();
    }
  });

  it("IndexedDB 失败时 store 仍先写入可恢复的轻量设置备份", async () => {
    vi.stubGlobal("indexedDB", failingIndexedDb());
    vi.stubGlobal("IDBKeyRange", {});
    localStorage.clear();
    const store = createStore();
    store.state.providers = [{
      id: "provider-a",
      displayName: "Provider A",
      baseUrl: "https://api.example.com/v1",
      responseFormat: "openai-compatible",
      defaultModel: "model-a",
      models: ["model-a"],
      enabled: true
    }];
    store.state.extensions = {
      tools: [{
        id: "weather",
        name: "weather_lookup",
        description: "查询天气",
        endpoint: "https://tools.example.com/weather",
        inputSchema: { type: "object", properties: {} },
        enabled: true
      }],
      skills: [{
        id: "review",
        name: "代码审查",
        description: "审查改动",
        instructions: "先找可复现问题。",
        enabled: true
      }],
      sandbox: { enabled: false },
      codeInterpreter: { enabled: false }
    };

    await store.persist();

    const backup = JSON.parse(localStorage.getItem(STORAGE_KEYS.state));
    expect(backup.providers[0].displayName).toBe("Provider A");
    expect(backup.extensions.tools[0].name).toBe("weather_lookup");
    expect(backup.extensions.skills[0].name).toBe("代码审查");
    expect(backup.lightweight).toBe(true);
  });
});

describe("UI 偏好", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("写入后读取一致", () => {
    writeUiPreferences({ themeId: "paper-dark", appearanceMode: "dark", drawerCollapsed: true });
    const prefs = readUiPreferences();
    expect(prefs.themeId).toBe("paper-dark");
    expect(prefs.appearanceMode).toBe("dark");
    expect(prefs.drawerCollapsed).toBe(true);
  });

  it("非法主题 ID 被丢弃、损坏 JSON 兜底默认值", () => {
    localStorage.setItem(STORAGE_KEYS.uiPreferences, "not-json{");
    const prefs = readUiPreferences();
    expect(prefs.themeId).toBe("");
    expect(prefs.appearanceMode).toBe("system");
    localStorage.setItem(STORAGE_KEYS.uiPreferences, JSON.stringify({ themeId: "../evil" }));
    expect(readUiPreferences().themeId).toBe("");
  });

  it("旧 themeFamily 以 legacyThemeFamily 暴露给主题控制器迁移", () => {
    localStorage.setItem(STORAGE_KEYS.uiPreferences, JSON.stringify({
      themeFamily: "cream-night",
      appearanceMode: "system",
      reduceTransparency: true
    }));
    const prefs = readUiPreferences();
    expect(prefs.legacyThemeFamily).toBe("cream-night");
    expect(prefs.appearanceMode).toBe("system");
  });
});

describe("app mode", () => {
  it("首版始终回落并持久化为 Chat", () => {
    writeAppMode("work");
    expect(readAppMode()).toBe("chat");
    writeAppMode("chat");
    expect(readAppMode()).toBe("chat");
  });
});

describe("载荷构建", () => {
  const state = () => ({
    conversations: [
      normalizeConversation({ id: "c1", title: "保留", providerId: "p1", messages: [] }),
      normalizeConversation({ id: "c2", title: "不保存", providerId: "p2", saveChats: false, messages: [] })
    ],
    providers: [
      normalizeProvider({ id: "p1", displayName: "A", baseUrl: "https://a.example", saveChats: true }),
      normalizeProvider({ id: "p2", displayName: "B", baseUrl: "https://b.example", saveChats: false })
    ],
    activeConversationId: "c2",
    activeProviderId: "p1",
    preferredReasoningEffort: "high",
    extensions: {
      tools: [{ id: "weather", name: "weather_lookup", description: "查询天气", endpoint: "https://tools.example.com/weather", inputSchema: { type: "object", properties: {} }, enabled: true }],
      skills: [{ id: "review", name: "审查", description: "审查代码", instructions: "只报告可复现问题。", enabled: true }],
      sandbox: { enabled: true }
    }
  });

  it("完整载荷过滤 saveChats=false 的会话并校正活跃 ID", () => {
    const payload = buildPersistentPayload(state());
    expect(payload.conversations.map((item) => item.id)).toEqual(["c1"]);
    expect(payload.activeConversationId).toBe("c1");
    expect(payload.extensions.tools[0].name).toBe("weather_lookup");
    expect(payload.extensions.skills[0].name).toBe("审查");
    expect(payload.extensions.sandbox.enabled).toBe(true);
  });

  it("轻量载荷剥离图片与附件正文", () => {
    const withMedia = {
      ...state(),
      conversations: [
        normalizeConversation({
          id: "c1",
          messages: [{
            id: "m1",
            role: "user",
            content: "正文",
            files: [{ name: "a.txt", text: "很长的附件内容" }],
            parts: [{ type: "image", source: "data:image/png;base64,eHg=", mimeType: "image/png", alt: "图" }]
          }]
        })
      ]
    };
    const payload = buildLightweightPayload(buildPersistentPayload(withMedia));
    const message = payload.conversations[0].messages[0];
    expect(message.files[0].text).toBe("");
    expect(message.parts[0].source).toBe("");
    expect(message.parts[0].stripped).toBe(true);
    expect(message.content).toBe("正文");
  });

  it("轻量载荷同样剥离 file part 的二进制源", () => {
    const withFile = {
      ...state(),
      conversations: [
        normalizeConversation({
          id: "c1",
          messages: [{
            id: "m1",
            role: "assistant",
            content: "生成的文件",
            parts: [{ type: "file", name: "voice.mp3", mimeType: "audio/mpeg", source: "data:audio/mpeg;base64,SU1Q", size: 3 }]
          }]
        })
      ]
    };
    const payload = buildLightweightPayload(buildPersistentPayload(withFile));
    const part = payload.conversations[0].messages[0].parts[0];
    expect(part.type).toBe("file");
    expect(part.name).toBe("voice.mp3");
    expect(part.source).toBe("");
    expect(part.stripped).toBe(true);
  });
});

describe("loadPersistedState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("无 IndexedDB 时回退 localStorage 轻量备份", async () => {
    vi.stubGlobal("IDBKeyRange", {});
    vi.stubGlobal("indexedDB", {
      open: vi.fn(() => {
        const request = {};
        queueMicrotask(() => {
          Object.defineProperty(request, "error", { value: new Error("database unavailable") });
          request.onerror?.();
        });
        return request;
      })
    });
    localStorage.clear();
    const backup = {
      version: "2.5.1",
      savedAt: 1000,
      conversations: [{ id: "c1", title: "回退", messages: [{ id: "m", role: "user", content: "hi" }] }],
      providers: [{ id: "p1", displayName: "P", baseUrl: "https://p.example" }],
      activeConversationId: "c1",
      activeProviderId: "p1",
      preferredReasoningEffort: "low",
      extensions: {
        tools: [{ id: "weather", name: "weather_lookup", description: "查询天气", endpoint: "https://tools.example.com/weather", inputSchema: { type: "object" }, enabled: true }]
      }
    };
    localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(backup));
    const loaded = await loadPersistedState();
    expect(loaded.conversations).toHaveLength(1);
    expect(loaded.conversations[0].title).toBe("回退");
    expect(loaded.providers[0].displayName).toBe("P");
    expect(loaded.preferredReasoningEffort).toBe("low");
    expect(loaded.extensions.tools[0].name).toBe("weather_lookup");
  });

  it("IDB 写失败导致记录陈旧时，较新的 localStorage 备份胜出", async () => {
    // 场景：IDB 可读但停在某次旧写入；用户此后的保存只落到了 localStorage。
    // 启动时若仍然 IDB 优先，旧配置会覆盖新配置（正是“保存失效”的表现）。
    vi.stubGlobal("IDBKeyRange", {});
    vi.stubGlobal("indexedDB", new IDBFactory());
    const staleRecord = {
      version: "1.0.0-exp",
      savedAt: 1000,
      conversations: [],
      providers: [{ id: "old", displayName: "旧配置", baseUrl: "https://old.example" }],
      activeProviderId: "old"
    };
    const archive = createStateArchive();
    await archive.save(staleRecord);
    localStorage.setItem(STORAGE_KEYS.state, JSON.stringify({
      version: "1.0.0-exp-2",
      savedAt: 9999,
      conversations: [],
      providers: [{ id: "new", displayName: "新配置", baseUrl: "https://new.example" }],
      activeProviderId: "new"
    }));
    const loaded = await loadPersistedState();
    expect(loaded.providers.map((p) => p.displayName)).toEqual(["新配置"]);
    localStorage.clear();
  });

  it("localStorage 降级骨架较新时仍让位于完整 IDB 归档", async () => {
    vi.stubGlobal("IDBKeyRange", {});
    vi.stubGlobal("indexedDB", new IDBFactory());
    const archive = createStateArchive();
    await archive.save({
      version: "1.0.0-exp-2",
      savedAt: 5000,
      conversations: [{ id: "c1", title: "完整会话", messages: [] }],
      providers: [{ id: "full", displayName: "完整配置", baseUrl: "https://full.example" }],
      activeProviderId: "full"
    });
    localStorage.setItem(STORAGE_KEYS.state, JSON.stringify({
      version: "1.0.0-exp-2",
      savedAt: 9000,
      degraded: true,
      conversations: [],
      providers: [{ id: "skeleton", displayName: "骨架配置", baseUrl: "https://skeleton.example" }],
      activeProviderId: "skeleton"
    }));
    const loaded = await loadPersistedState();
    expect(loaded.providers.map((p) => p.displayName)).toEqual(["完整配置"]);
    expect(loaded.conversations[0].title).toBe("完整会话");
    localStorage.clear();
  });

  it("活动供应商已禁用时回退到首个启用项；全部禁用时保持为空", async () => {
    localStorage.setItem(STORAGE_KEYS.state, JSON.stringify({
      providers: [
        { id: "disabled", displayName: "Disabled", baseUrl: "https://disabled.example", enabled: false },
        { id: "enabled", displayName: "Enabled", baseUrl: "https://enabled.example", enabled: true }
      ],
      activeProviderId: "disabled"
    }));
    expect((await loadPersistedState()).activeProviderId).toBe("enabled");

    localStorage.setItem(STORAGE_KEYS.state, JSON.stringify({
      providers: [
        { id: "disabled", displayName: "Disabled", baseUrl: "https://disabled.example", enabled: false }
      ],
      activeProviderId: "disabled"
    }));
    expect((await loadPersistedState()).activeProviderId).toBe("");
  });

  it("移除历史 demo 与内置测试供应商，同时保留会话快照", async () => {
    localStorage.setItem(STORAGE_KEYS.state, JSON.stringify({
      providers: [
        { id: "demo-openai-compatible", displayName: "示例 · OpenAI Chat Completions", baseUrl: "https://api.example.com/v1" },
        { id: "demo-responses", displayName: "示例 · OpenAI Responses", baseUrl: "https://api.openai.com/v1" },
        { id: "demo-anthropic", displayName: "示例 · Anthropic Messages", baseUrl: "https://api.anthropic.com/v1" },
        { id: "demo-google", displayName: "示例 · Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
        { id: "test-responses", displayName: "测试供应商 · Responses API", baseUrl: "https://api.test-chatbox.florasunshina.io/v1" },
        { id: "renamed-test", displayName: "改名后的测试供应商", baseUrl: "https://api.test-chatbox.florasunshina.io/v1/" }
      ],
      activeProviderId: "demo-openai-compatible",
      conversations: [{
        id: "legacy-conversation",
        providerId: "demo-openai-compatible",
        providerSnapshot: { displayName: "示例 · OpenAI Chat Completions", baseUrl: "https://api.example.com/v1" },
        messages: []
      }]
    }));

    const loaded = await loadPersistedState();
    expect(loaded.providers).toEqual([]);
    expect(loaded.activeProviderId).toBe("");
    expect(loaded.retiredProviderMigrationApplied).toBe(true);
    expect(loaded.conversations).toHaveLength(1);
    expect(loaded.conversations[0].providerId).toBe("demo-openai-compatible");
  });

  it("完全无数据返回 null", async () => {
    expect(await loadPersistedState()).toBeNull();
  });
});
