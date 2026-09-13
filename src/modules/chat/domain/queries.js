import { getActivePath } from "./tree.js";
export function sortConversations(conversations) {
  return [...conversations].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

/** 压缩摘要仅在边界消息仍然存在时有效。 */
export function getValidContextCompression(conversation) {
  const compression = conversation && conversation.contextCompression;
  if (!compression || !compression.throughMessageId) return null;
  const boundary = getActivePath(conversation).findIndex((message) => message.id === compression.throughMessageId);
  if (boundary < 0) return null;
  return { compression, boundaryIndex: boundary };
}

/** 压缩点之后的消息（请求时只发送摘要 + 这些消息）。 */
export function getMessagesAfterCompression(conversation) {
  const valid = getValidContextCompression(conversation);
  const path = getActivePath(conversation);
  if (!valid) return path;
  return path.slice(valid.boundaryIndex + 1);
}

/** 编辑/删除压缩点内（含边界）的消息时失效压缩。 */
export function invalidateCompressionForIndex(conversation, changedIndex) {
  const valid = getValidContextCompression(conversation);
  if (!valid) return false;
  if (valid.boundaryIndex >= changedIndex) {
    conversation.contextCompression = null;
    return true;
  }
  return false;
}


/** Draft shells are persisted for recovery but are not history entries. Legacy records stay visible. */
export function isTemporaryConversation(conversation) {
  return conversation?.isTemporary === true && !conversation.messages.some(message => message.role === 'user');
}

export function contextMessages(conversation) {
    return getMessagesAfterCompression(conversation)
      .filter((message) => !message.noticeKind)
      .filter((message) => message.content || (message.files && message.files.length) || (message.parts && message.parts.length))
      .map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.files && message.files.length ? { files: message.files } : {}),
        ...(message.parts && message.parts.length ? { parts: message.parts.filter((part) => part.type === "image" || part.type === "text" || part.type === "file") } : {})
      }));
  }

