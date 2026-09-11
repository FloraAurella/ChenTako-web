import { describe, expect, it, vi } from "vitest";
import { createStore } from "../src/app/state/store.js";

describe("细粒度 Store 订阅", () => {
  it("流式快照只通知目标 stream/会话，不重渲当前消息模板或触发全局订阅", () => {
    const store = createStore();
    const conversation = store.createConversation({ silent: true });
    const message = { id: "assistant-1", role: "assistant", content: "", reasoning: "" };
    conversation.messages.push(message);
    const globalListener = vi.fn();
    const appListener = vi.fn();
    const streamListener = vi.fn();
    const messageListener = vi.fn();
    store.subscribe(globalListener);
    store.subscribeKey("app", appListener);
    store.subscribeKey(`stream:${conversation.id}`, streamListener);
    store.subscribeKey(`message:${conversation.id}:${message.id}`, messageListener);

    store.actions.publishStreamSnapshot(conversation.id, message.id, {
      content: "增量正文",
      reasoning: "增量思考",
      reasoningKind: "thinking"
    });

    expect(globalListener).not.toHaveBeenCalled();
    expect(appListener).not.toHaveBeenCalled();
    expect(streamListener).toHaveBeenCalledTimes(1);
    expect(messageListener).not.toHaveBeenCalled();
    expect(message.content).toBe("增量正文");

    store.actions.startStream(conversation.id);
    store.actions.endStream(conversation.id);
    expect(store.getSnapshot(`stream:${conversation.id}`).value).toBeNull();
    expect(store.getSnapshot("stream-list").value.has(conversation.id)).toBe(false);
  });

  it("未变化的 key 返回同一快照引用，精确更新后才递增", () => {
    const store = createStore();
    const before = store.getSnapshot("sidebar");
    expect(store.getSnapshot("sidebar")).toBe(before);

    const globalListener = vi.fn();
    const sidebarListener = vi.fn();
    store.subscribe(globalListener);
    store.subscribeKey("sidebar", sidebarListener);
    store.actions.setSidebar({ archivesMode: "collapsed" });

    const after = store.getSnapshot("sidebar");
    expect(after).not.toBe(before);
    expect(after.version).toBe(before.version + 1);
    expect(after.value.archivesMode).toBe("collapsed");
    expect(sidebarListener).toHaveBeenCalledTimes(1);
    expect(globalListener).not.toHaveBeenCalled();
  });

  it("新会话跟随聊天默认思考档位，忽略供应商旧参数", () => {
    const store = createStore();
    const state = store.state as any;
    state.providers.push({
      id: "test-responses",
      displayName: "测试供应商",
      defaultModel: "test-1",
      defaultReasoningEffort: "low",
      models: ["test-1"]
    });
    state.activeProviderId = "test-responses";

    const conversation = store.createConversation({ silent: true });
    expect(conversation.reasoningEffort).toBe("medium");
    expect(conversation.reasoningEffortOverride).toBeNull();
  });
});
