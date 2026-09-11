"use strict";

import { describe, it, expect } from "vitest";
import { normalizeConversation } from "../src/contracts/normalize.js";
import {
  appendToActivePath,
  flattenVisiblePrefix,
  forkUserMessage,
  getActiveLeaf,
  getActivePath,
  getMessageSubtreeIds,
  getUserVariants,
  removeMessageSubtree,
  selectMessageVariant
} from "../src/modules/chat/domain/tree.js";
import { getMessagesAfterCompression, getValidContextCompression } from "../src/app/state/store.js";

function conversation() {
  return normalizeConversation({
    id: "c1",
    messages: [
      { id: "u1", role: "user", content: "问题 A" },
      { id: "a1", role: "assistant", content: "回答 A" },
      { id: "u2", role: "user", content: "问题 B" },
      { id: "a2", role: "assistant", content: "回答 B" }
    ]
  });
}

describe("conversation tree", () => {
  it("migrates a legacy linear array and exposes the complete active path", () => {
    const value = conversation();
    expect(value.messages.map((message) => message.parentId)).toEqual([null, "u1", "a1", "u2"]);
    expect(getActivePath(value).map((message) => message.id)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(getActiveLeaf(value).id).toBe("a2");
  });

  it("forks a user message without mutating the original suffix", () => {
    const value = conversation();
    value.messages.find((message) => message.id === "u2").skippedAttachments = [{ name: "old.pdf", reason: "不支持" }];
    const forked = forkUserMessage(value, "u2", { content: "问题 B′" });
    expect(forked).toMatchObject({ role: "user", content: "问题 B′", parentId: "a1" });
    expect(forked.skippedAttachments).toEqual([]);
    expect(value.messages.find((message) => message.id === "u2").content).toBe("问题 B");
    expect(getActivePath(value).map((message) => message.content)).toEqual(["问题 A", "回答 A", "问题 B′"]);
    expect(getUserVariants(value, forked.id, getActivePath(value))).toMatchObject({ activeIndex: 1, total: 2 });
  });

  it("editing the first user message creates and selects a new root branch", () => {
    const value = conversation();
    const forked = forkUserMessage(value, "u1", { content: "问题 A′" });
    expect(forked.parentId).toBeNull();
    expect(value.activeRootMessageId).toBe(forked.id);
    expect(getActivePath(value).map((message) => message.id)).toEqual([forked.id]);

    selectMessageVariant(value, "u1");
    expect(getActivePath(value).map((message) => message.id)).toEqual(["u1", "a1", "u2", "a2"]);
  });

  it("switches siblings while preserving each branch's deeper selection", () => {
    const value = conversation();
    const forked = forkUserMessage(value, "u2", { content: "问题 B′" });
    appendToActivePath(value, { id: "a2b", role: "assistant", content: "回答 B′" });
    appendToActivePath(value, { id: "u3b", role: "user", content: "后续 B′" });
    selectMessageVariant(value, "u2");
    expect(getActivePath(value).map((message) => message.id)).toEqual(["u1", "a1", "u2", "a2"]);
    selectMessageVariant(value, forked.id);
    expect(getActivePath(value).map((message) => message.id)).toEqual(["u1", "a1", forked.id, "a2b", "u3b"]);
  });

  it("deletes only the selected subtree and keeps sibling branches", () => {
    const value = conversation();
    const forked = forkUserMessage(value, "u2", { content: "问题 B′" });
    appendToActivePath(value, { id: "a2b", role: "assistant", content: "回答 B′" });
    expect(getMessageSubtreeIds(value, forked.id)).toEqual(new Set([forked.id, "a2b"]));
    removeMessageSubtree(value, forked.id);
    expect(value.messages.map((message) => message.id)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(getActivePath(value).at(-1).id).toBe("a2");
  });

  it("flattens only the visible prefix for copy-to-new-conversation", () => {
    const value = conversation();
    forkUserMessage(value, "u2", { content: "问题 B′" });
    const prefix = flattenVisiblePrefix(value, getActiveLeaf(value).id);
    expect(prefix.map((message) => message.content)).toEqual(["问题 A", "回答 A", "问题 B′"]);
    expect(prefix.map((message) => message.parentId)).toEqual([null, prefix[0].id, prefix[1].id]);
  });

  it("损坏的活动子节点指针回退到最新直接子节点", () => {
    const value = conversation();
    value.activeChildByMessageId.a1 = "missing";
    expect(getActivePath(value).map((message) => message.id)).toEqual(["u1", "a1", "u2", "a2"]);
  });

  it("分叉暂不使用不在当前路径的压缩摘要，切回原分支后摘要恢复", () => {
    const value = conversation();
    value.contextCompression = {
      summary: "B 之前的摘要",
      throughMessageId: "u2",
      sourceMessageCount: 3,
      model: "test",
      createdAt: Date.now()
    };

    const forked = forkUserMessage(value, "u2", { content: "问题 B′" });
    expect(getValidContextCompression(value)).toBeNull();
    expect(getMessagesAfterCompression(value).map((message) => message.id)).toEqual(["u1", "a1", forked.id]);

    selectMessageVariant(value, "u2");
    expect(getValidContextCompression(value)).toMatchObject({ boundaryIndex: 2 });
    expect(getMessagesAfterCompression(value).map((message) => message.id)).toEqual(["a2"]);
  });
});
