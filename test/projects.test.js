import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createStore } from "../src/app/state/store.js";
import { normalizeConversation } from "../src/contracts/normalize.js";
import { normalizeProjects } from "../src/modules/projects/domain/model.js";
import { buildPersistentPayload, buildLightweightPayload, loadPersistedState, createStateArchive } from "../src/app/state/persistence.js";
import { STORAGE_KEYS } from "../src/contracts/constants.js";
import { exportConversationArchive, importConversationArchive } from "../src/modules/data/domain/archive.js";

beforeEach(() => { localStorage.clear(); vi.stubGlobal("indexedDB", new IDBFactory()); vi.stubGlobal("IDBKeyRange", IDBKeyRange); vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] }); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("项目分类与状态兼容", () => {
  it("新建从当前选中聊天继承，显式 null 和项目覆盖均有效", () => {
    const store = createStore();
    const a = store.createProject(" A ");
    const b = store.createProject("B");
    const old = store.createConversation({ projectId: a.id, silent: true });
    store.createConversation({ projectId: b.id, silent: true });
    store.state.activeConversationId = old.id;
    expect(store.createConversation({ silent: true }).projectId).toBe(a.id);
    expect(store.createConversation({ projectId: null, silent: true }).projectId).toBeNull();
    expect(store.createConversation({ projectId: b.id, silent: true }).projectId).toBe(b.id);
    expect(store.createConversation({ projectId: "missing", silent: true }).projectId).toBeNull();
    expect(store.state.projects.map(p => p.name)).toEqual(["A", "B"]);
    expect(() => store.createProject("   ")).toThrow();
  });

  it("移动及删除项目保留对象、消息、草稿、附件和流式状态，不更新时间", () => {
    const store = createStore();
    const a = store.createProject("A");
    const b = store.createProject("B");
    const chat = store.createConversation({ projectId: a.id, silent: true });
    chat.draft = "未发送草稿";
    chat.messages.push({ id: "answer", role: "assistant", content: "部分内容" });
    const messages = chat.messages;
    const pending = [{ id: "file", name: "笔记.txt", text: "附件内容" }];
    store.state.pendingAttachments = pending;
    const timestamp = chat.updatedAt;
    store.actions.startStream(chat.id);
    store.moveConversationToProject(chat.id, b.id);
    store.renameProject(b.id, "B 改名");
    expect(store.activeConversation()).toBe(chat);
    expect(chat.messages).toBe(messages);
    expect(chat.updatedAt).toBe(timestamp);
    expect(store.state.pendingAttachments).toBe(pending);
    store.actions.publishStreamSnapshot(chat.id, "answer", { content: "继续生成", reasoning: "", reasoningKind: "thinking" });
    expect(chat.messages[0].content).toBe("继续生成");
    expect(store.state.activeStreamIds.has(chat.id)).toBe(true);
    store.deleteProject(b.id);
    expect(chat.projectId).toBeNull();
    expect(chat.messages).toBe(messages);
    expect(chat.draft).toBe("未发送草稿");
    expect(chat.updatedAt).toBe(timestamp);
    expect(store.state.projects.map(p => p.id)).toEqual([a.id]);
  });

  it("旧数据与悬空引用归为无项目，空项目和折叠偏好通过完整及轻量备份恢复", async () => {
    const old = { conversations: [{ id: "legacy", title: "旧聊天" }, { id: "dangling", projectId: "missing" }], providers: [] };
    localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(old));
    const legacy = await loadPersistedState();
    expect(legacy.projects).toEqual([]);
    expect(legacy.conversations.map(c => c.projectId)).toEqual([null, null]);
    const store = createStore();
    const p = store.createProject("空项目");
    const populated = store.createProject("有聊天");
    store.createConversation({ projectId: populated.id, silent: true });
    store.actions.setSidebar({ collapsedSections: ["projects"], collapsedProjectIds: [p.id] });
    const full = buildPersistentPayload(store.state);
    const light = buildLightweightPayload(full);
    expect(light.projects).toEqual(full.projects);
    expect(light.conversations[0].projectId).toBe(populated.id);
    localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(light));
    const restored = await loadPersistedState();
    expect(restored.projects).toEqual(full.projects);
    expect(restored.projectSidebar.collapsedSections).toEqual(["projects"]);
    await createStateArchive().save({ ...full, savedAt: Date.now() + 1000 });
    localStorage.removeItem(STORAGE_KEYS.state);
    const reloaded = createStore();
    await reloaded.load();
    expect(reloaded.state.projects).toEqual(full.projects);
    expect(reloaded.activeConversation().projectId).toBe(populated.id);
    expect(reloaded.state.sidebar.collapsedProjectIds).toEqual([p.id]);
  });

  it("独立聊天导入丢弃来源项目归属，消息保留", async () => {
    const original = normalizeConversation({ id: "import", projectId: "external", title: "独立聊天", messages: [{ id: "m", role: "user", content: "原始内容" }] });
    const { bytes } = exportConversationArchive(original);
    const file = { name: "chat.clawbox.zip", size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    const imported = await importConversationArchive(file, []);
    expect(imported.projectId).toBeNull();
    expect(imported.messages[0].content).toBe("原始内容");
  });

  it("项目 ID 去重，同名允许，按创建时间排序并限制名称长度", () => {
    expect(normalizeProjects([{ id: "b", name: "同名", createdAt: 2 }, { id: "a", name: "同名", createdAt: 1 }, { id: "a", name: "重复", createdAt: 3 }, { name: " " }]).map(p => p.id)).toEqual(["a", "b"]);
    expect(normalizeProjects([{ name: "长".repeat(80) }])[0].name).toHaveLength(60);
  });
});
