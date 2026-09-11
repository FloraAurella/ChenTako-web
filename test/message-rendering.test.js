"use strict";

import { describe, it, expect } from "vitest";
import { normalizeConversation } from "../src/contracts/normalize.js";
import { forkUserMessage, getActivePath } from "../src/modules/chat/domain/tree.js";
import {
  preloadConversationMessageHtml,
  renderMessageHtml,
  renderMessageHtmlCached
} from "../src/modules/chat/services/message-rendering.js";

function state() {
  const conversation = normalizeConversation({
    messages: [
      { id: "u1", role: "user", content: "问题 A" },
      { id: "a1", role: "assistant", content: "回答 A" },
      { id: "u2", role: "user", content: "问题 B" },
      { id: "a2", role: "assistant", content: "回答 B" }
    ]
  });
  const forked = forkUserMessage(conversation, "u2", { content: "问题 B′" });
  return { conversation, forked, path: getActivePath(conversation) };
}

const baseOptions = (conversation, index, pathLength, extras = {}) => ({
  conversation,
  index,
  pathLength,
  providerName: "测试模型",
  streamActive: false,
  streamMessageId: "",
  editingMessageId: "",
  compressing: false,
  ...extras
});

describe("message branch rendering", () => {
  it("renders an accessible user branch switcher", () => {
    const { conversation, forked, path } = state();
    const html = renderMessageHtml(path[2], baseOptions(conversation, 2, path.length, {
      branch: { current: 2, total: 2, hasPrevious: true, hasNext: false }
    }));
    expect(html).toContain("message-branch-switcher");
    expect(html).toContain("2 / 2");
    expect(html).toContain('aria-label="上一个消息分支"');
    expect(html).toContain('aria-label="下一个消息分支" disabled');
    expect(html).toContain(`data-message-id="${forked.id}"`);
  });

  it("keeps branch navigation enabled while another response is streaming", () => {
    const { conversation, path } = state();
    const html = renderMessageHtml(path[2], baseOptions(conversation, 2, path.length, {
      branch: { current: 2, total: 2, hasPrevious: true, hasNext: false },
      streamActive: true,
      streamMessageId: "a2"
    }));
    expect(html).toContain('data-message-branch="previous"');
    expect(html).not.toMatch(/data-message-branch="previous"[^>]*disabled/);
    expect(html).toContain('data-message-branch="next"');
    expect(html).toMatch(/data-message-branch="next"[^>]*disabled/);
    expect(html).not.toContain("生成中不可切换");
  });

  it("空的流式助手消息只进入等待态，不预先渲染思考标记", () => {
    const { conversation, path } = state();
    const pending = { id: "a-pending", role: "assistant", content: "", reasoning: "", parts: [], files: [] };
    const html = renderMessageHtml(pending, baseOptions(conversation, path.length, path.length + 1, {
      streamActive: true,
      streamMessageId: pending.id,
      streamExpectsImage: false
    }));
    expect(html).toContain("is-response-pending");
    expect(html).not.toContain("reasoning-sheet");
    expect(html).not.toContain("正在思考");
  });

  it("preloads the active path and invalidates a cached card after its text changes", () => {
    const { conversation, path } = state();
    expect(preloadConversationMessageHtml(conversation, { providerName: "测试模型" })).toBe(path.length);
    const options = baseOptions(conversation, 2, path.length);
    const first = renderMessageHtmlCached(path[2], options);
    expect(first).toContain("问题 B′");

    path[2].content = "问题 B′ 已更新";
    const next = renderMessageHtmlCached(path[2], options);
    expect(next).toContain("问题 B′ 已更新");
  });

  it("removes user save and keeps assistant save", () => {
    const { conversation, path } = state();
    const userEditor = renderMessageHtml(path[2], baseOptions(conversation, 2, path.length, {
      editingMessageId: path[2].id
    }));
    expect(userEditor).not.toContain('data-editor="save"');
    expect(userEditor).toContain('data-editor="resend"');

    const assistant = conversation.messages.find((message) => message.id === "a2");
    const assistantEditor = renderMessageHtml(assistant, baseOptions(conversation, 3, path.length, {
      editingMessageId: assistant.id
    }));
    expect(assistantEditor).toContain('data-editor="save"');
    expect(assistantEditor).not.toContain('data-editor="resend"');
  });

  it("disables user resend when both text and attachments are empty", () => {
    const { conversation, path } = state();
    const empty = { ...path[2], content: "", files: [], parts: [] };
    const html = renderMessageHtml(empty, baseOptions(conversation, 2, path.length, {
      editingMessageId: empty.id
    }));
    expect(html).toContain('data-editor="resend"');
    expect(html).toMatch(/data-editor="resend"[^>]*\sdisabled/);
  });

  it("escapes imported message IDs and file names in HTML attributes", () => {
    const { conversation, path } = state();
    const unsafeId = 'x" onmouseover="alert(1)';
    const html = renderMessageHtml({
      ...path[2],
      id: unsafeId,
      files: [{ name: 'report" onmouseover="alert(2).txt', text: "内容" }]
    }, baseOptions(conversation, 2, path.length));
    expect(html).toContain('data-message-id="x&quot; onmouseover=&quot;alert(1)"');
    expect(html).toContain('title="report&quot; onmouseover=&quot;alert(2).txt"');
    expect(html).not.toContain('<span class="file-name" title="report" onmouseover=');
  });
});
