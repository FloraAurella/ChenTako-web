import { appendToActivePath } from '../domain/tree.js';
export function createChatStateActions({state,conversationById,notify,notifyKeys,persistSoon,touchConversation}) {return {
    appendMessage(conversationId, message) {
      const conversation = conversationById(conversationId);
      if (!conversation) return null;
      appendToActivePath(conversation, message);
      notify("conversation-updated", [
        `conversation:${conversationId}`,
        `message:${conversationId}:${message.id}`
      ]);
      return message;
    },
    patchMessage(conversationId, messageId, patch, { persist: shouldPersist = false } = {}) {
      const conversation = conversationById(conversationId);
      const message = conversation?.messages.find((item) => item.id === messageId);
      if (!message) return null;
      Object.assign(message, patch);
      notify("message-updated", [
        `conversation:${conversationId}`,
        `message:${conversationId}:${messageId}`
      ]);
      if (shouldPersist) persistSoon();
      return message;
    },
    publishStreamSnapshot(conversationId, messageId, snapshot) {
      if (typeof window !== "undefined" && window.__AI_CHATBOX_STREAM_METRICS__) {
        const metrics = window.__AI_CHATBOX_STREAM_METRICS__;
        metrics.storePublishes = Number(metrics.storePublishes || 0) + 1;
      }
      state.streaming = { conversationId, messageId, snapshot };
      state.streamSnapshots.set(conversationId, { conversationId, messageId, snapshot });
      const conversation = conversationById(conversationId);
      const message = conversation?.messages.find((item) => item.id === messageId);
      if (message) {
        message.content = snapshot.content;
        message.reasoning = snapshot.reasoning;
        message.reasoningKind = snapshot.reasoningKind;
      }
      notifyKeys([
        `stream:${conversationId}`,
        `conversation:${conversationId}`
      ]);
    },
    startStream(conversationId) {
      state.activeStreamIds = new Set(state.activeStreamIds).add(conversationId);
      notifyKeys(["stream-list"]);
    },
    endStream(conversationId) {
      const hasActiveStream = state.activeStreamIds.has(conversationId);
      const hasSnapshot = state.streamSnapshots.has(conversationId);
      if (!hasActiveStream && !hasSnapshot) return;
      state.activeStreamIds = new Set([...state.activeStreamIds].filter((id) => id !== conversationId));
      state.streamSnapshots.delete(conversationId);
      if (state.streaming?.conversationId === conversationId) state.streaming = null;
      notifyKeys(["stream-list", `stream:${conversationId}`]);
    },
    setCompression(conversationId, running) {
      const current = state.compressionConversationIds;
      if (current.has(conversationId) === Boolean(running)) return;
      state.compressionConversationIds = new Set(current);
      if (running) state.compressionConversationIds.add(conversationId);
      else state.compressionConversationIds.delete(conversationId);
      notifyKeys(["compression"]);
    },
    finishStream(conversationId, messageId, patch) {
      const conversation = conversationById(conversationId);
      const message = conversation?.messages.find((item) => item.id === messageId);
      if (message) Object.assign(message, patch);
      if (state.streaming?.conversationId === conversationId) state.streaming = null;
      state.streamSnapshots.delete(conversationId);
      state.activeStreamIds = new Set([...state.activeStreamIds].filter((id) => id !== conversationId));
      if (conversation) touchConversation(conversation, { silent: true });
      persistSoon();
      notify("stream-end", [
        "conversation-list",
        "stream-list",
        `stream:${conversationId}`,
        `conversation:${conversationId}`,
        `message:${conversationId}:${messageId}`
      ]);
    },
};}
