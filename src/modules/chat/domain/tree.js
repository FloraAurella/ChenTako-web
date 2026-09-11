"use strict";

/**
 * Message-tree primitives used by the chat controller, renderer and storage
 * migration.  The conversation still owns one `messages` array; this module
 * defines how that array is projected into the one path currently shown to a
 * user.
 */

const ROOT = null;

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function messagesOf(conversation) {
  return conversation && Array.isArray(conversation.messages) ? conversation.messages : [];
}

// The active path is read for every streamed frame.  Cache the immutable
// message topology by array identity/length so those reads do not rebuild an
// O(n) index until a node is appended or the array is replaced after a delete.
const topologyCache = new WeakMap();

function topologyOf(conversation) {
  const messages = messagesOf(conversation);
  const cached = topologyCache.get(messages);
  if (cached && cached.length === messages.length) return cached;
  const byId = new Map();
  const childrenByParent = new Map();
  for (const message of messages) {
    const id = String(message.id);
    byId.set(id, message);
    const parent = message.parentId == null ? ROOT : String(message.parentId);
    const children = childrenByParent.get(parent) || [];
    children.push(message);
    childrenByParent.set(parent, children);
  }
  const index = { messages, length: messages.length, byId, childrenByParent };
  topologyCache.set(messages, index);
  return index;
}

function childrenOf(conversation, parentId) {
  const normalized = parentId == null ? ROOT : String(parentId);
  return topologyOf(conversation).childrenByParent.get(normalized) || [];
}

function linearizeInPlace(conversation) {
  const messages = messagesOf(conversation);
  messages.forEach((message, index) => {
    message.parentId = index ? String(messages[index - 1].id) : null;
  });
  conversation.activeRootMessageId = messages[0] ? String(messages[0].id) : "";
  const selections = Object.create(null);
  messages.slice(0, -1).forEach((message, index) => {
    selections[String(message.id)] = String(messages[index + 1].id);
  });
  conversation.activeChildByMessageId = selections;
  topologyCache.delete(messages);
  return messages;
}

function ensureSelectionObject(conversation) {
  if (!conversation) return {};
  const current = conversation.activeChildByMessageId;
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    conversation.activeChildByMessageId = Object.create(null);
    return conversation.activeChildByMessageId;
  }
  // Message IDs come from imported/local data and may be object-prototype
  // names.  Copy regular dictionaries into a null-prototype map before any
  // bracket assignment so `__proto__` cannot mutate the object prototype.
  if (Object.getPrototypeOf(current) !== null) {
    const safe = Object.create(null);
    Object.keys(current).forEach((key) => {
      const value = current[key];
      if (typeof value === "string" || typeof value === "number") safe[key] = String(value);
    });
    conversation.activeChildByMessageId = safe;
  }
  return conversation.activeChildByMessageId;
}

function isDirectChild(message, parentId) {
  return Boolean(message) && (message.parentId == null ? ROOT : String(message.parentId)) === (parentId == null ? ROOT : String(parentId));
}

/** Return the currently selected root-to-leaf path. */
export function getActivePath(conversation) {
  const messages = messagesOf(conversation);
  if (!messages.length) return [];
  const { byId } = topologyOf(conversation);
  const roots = childrenOf(conversation, ROOT);
  if (!roots.length) {
    // A runtime/imported cycle has no root at all.  Restore all nodes in their
    // deterministic creation order so the conversation never becomes blank
    // or traps a caller in a loop.
    return linearizeInPlace(conversation);
  }

  const requestedRoot = byId.get(String(conversation.activeRootMessageId || ""));
  const root = requestedRoot && requestedRoot.parentId == null ? requestedRoot : roots[roots.length - 1];
  const selections = ensureSelectionObject(conversation);
  const path = [];
  const seen = new Set();
  let current = root;
  while (current && !seen.has(String(current.id))) {
    path.push(current);
    seen.add(String(current.id));
    const childId = selections[String(current.id)];
    const child = childId ? byId.get(String(childId)) : null;
    if (isDirectChild(child, current.id)) {
      current = child;
      continue;
    }
    // A damaged/migrating store may have lost an activity pointer.  Keep the
    // path deterministic and readable by using the newest direct child; the
    // caller can persist a repaired map through repairActiveSelections().
    const fallback = childrenOf(conversation, current.id).at(-1);
    if (!fallback) break;
    current = fallback;
  }
  return path;
}

export function getActiveLeaf(conversation) {
  const path = getActivePath(conversation);
  return path[path.length - 1] || null;
}

/**
 * Return user-message siblings for a rendered message.  Branches are only
 * created for user messages, so assistant/tool siblings are intentionally not
 * exposed as a branch selector.
 */
export function getUserVariants(conversation, messageId, activePath) {
  const { byId } = topologyOf(conversation);
  const message = byId.get(String(messageId || ""));
  if (!message || message.role !== "user") return { messages: [], activeIndex: -1, total: 0 };
  const variants = childrenOf(conversation, message.parentId).filter((item) => item.role === "user");
  const activeId = (activePath || getActivePath(conversation)).find((item) => item.parentId === message.parentId && item.role === "user")?.id;
  const activeIndex = variants.findIndex((item) => String(item.id) === String(activeId || message.id));
  return { messages: variants, activeIndex, total: variants.length };
}

/** Select a message and preserve all deeper selections below that message. */
export function selectMessageVariant(conversation, messageId) {
  const { byId } = topologyOf(conversation);
  const message = byId.get(String(messageId || ""));
  if (!message) return false;
  const selections = ensureSelectionObject(conversation);
  if (message.parentId == null) conversation.activeRootMessageId = message.id;
  else selections[String(message.parentId)] = message.id;
  return true;
}

/** Append a message to the selected leaf and make it the active child. */
export function appendToActivePath(conversation, message) {
  if (!conversation || !message) return null;
  const leaf = getActiveLeaf(conversation);
  const parentId = leaf ? leaf.id : null;
  message.parentId = parentId == null ? null : String(parentId);
  if (!Array.isArray(conversation.messages)) conversation.messages = [];
  conversation.messages.push(message);
  const selections = ensureSelectionObject(conversation);
  if (message.parentId == null) conversation.activeRootMessageId = message.id;
  else selections[message.parentId] = message.id;
  return message;
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

/** Create an immutable user sibling from an edited message draft. */
export function forkUserMessage(conversation, sourceMessageId, draft = {}) {
  const source = topologyOf(conversation).byId.get(String(sourceMessageId || ""));
  if (!source || source.role !== "user") return null;
  const message = {
    ...clone(source),
    ...clone(draft),
    id: makeId(),
    role: "user",
    parentId: source.parentId == null ? null : String(source.parentId),
    createdAt: Date.now(),
    reasoning: "",
    reasoningKind: "thinking",
    skippedAttachments: [],
    usage: null,
    error: "",
    stopped: false,
    durationMs: 0,
    reasoningMs: 0
  };
  delete message.noticeKind;
  delete message.noticeState;
  if (!Array.isArray(message.files)) message.files = [];
  if (!Array.isArray(message.parts)) message.parts = [];
  conversation.messages.push(message);
  selectMessageVariant(conversation, message.id);
  return message;
}

export function getMessageSubtreeIds(conversation, rootId) {
  const id = String(rootId || "");
  const { childrenByParent } = topologyOf(conversation);
  const descendants = new Set([id]);
  const stack = [id];
  while (stack.length) {
    const parentId = stack.pop();
    for (const child of childrenByParent.get(String(parentId)) || []) {
      if (descendants.has(String(child.id))) continue;
      descendants.add(String(child.id));
      stack.push(String(child.id));
    }
  }
  return descendants;
}

/** Remove one node and its descendants, leaving sibling branches intact. */
export function removeMessageSubtree(conversation, messageId) {
  if (!conversation) return [];
  const removedIds = getMessageSubtreeIds(conversation, messageId);
  if (!removedIds.size || !messagesOf(conversation).some((item) => removedIds.has(String(item.id)))) return [];
  conversation.messages = messagesOf(conversation).filter((message) => !removedIds.has(String(message.id)));
  const selections = ensureSelectionObject(conversation);
  const { byId } = topologyOf(conversation);
  Object.keys(selections).forEach((parentId) => {
    if (removedIds.has(String(selections[parentId])) || !byId.has(String(selections[parentId]))) {
      delete selections[parentId];
    }
  });
  if (removedIds.has(String(conversation.activeRootMessageId || ""))) {
    conversation.activeRootMessageId = childrenOf(conversation, ROOT).at(-1)?.id || "";
  }
  repairActiveSelections(conversation);
  return [...removedIds];
}

/** Return the active path prefix as a fresh, linearizable array. */
export function flattenVisiblePrefix(conversation, throughMessageId = "") {
  const path = getActivePath(conversation);
  const through = String(throughMessageId || "");
  const end = through ? path.findIndex((message) => message.id === through) : path.length - 1;
  if (end < 0) return [];
  const prefix = path.slice(0, end + 1).map((message) => clone(message));
  prefix.forEach((message, index) => {
    message.parentId = index > 0 ? prefix[index - 1].id : null;
  });
  return prefix;
}

/** Repair selections after imports or destructive edits. */
export function repairActiveSelections(conversation) {
  if (!conversation) return conversation;
  const messages = messagesOf(conversation);
  const { byId } = topologyOf(conversation);
  const roots = childrenOf(conversation, ROOT);
  const selections = ensureSelectionObject(conversation);
  conversation.activeRootMessageId = roots.some((item) => String(item.id) === String(conversation.activeRootMessageId || ""))
    ? String(conversation.activeRootMessageId)
    : (roots.at(-1)?.id || "");
  Object.keys(selections).forEach((parentId) => {
    const parent = byId.get(parentId);
    const selected = byId.get(String(selections[parentId] || ""));
    if (!parent || !isDirectChild(selected, parentId)) delete selections[parentId];
  });
  for (const parent of messages) {
    const children = childrenOf(conversation, parent.id);
    if (children.length && !selections[parent.id]) selections[parent.id] = children.at(-1).id;
  }
  return conversation;
}
