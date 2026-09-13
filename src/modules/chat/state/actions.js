import { isTemporaryConversation } from '../domain/queries.js';
import { appendToActivePath } from '../domain/tree.js';
export function createChatStateActions({state,conversationById,notify,notifyKeys,persistSoon,touchConversation,createConversation}) {return {
    openTemporaryConversation({ projectId = state.conversations.find(item => item.id === state.activeConversationId)?.projectId ?? null, silent = false } = {}) {
      const validProjectId = state.projects.some(project => project.id === projectId) ? projectId : null;
      const matches = item => isTemporaryConversation(item) && (item.projectId ?? null) === validProjectId;
      // Moving/deleting projects can bring multiple recovered drafts into one group.
      // Keep the active draft stable; the remaining drafts stay available after it is sent.
      const existing = state.conversations.find(item => item.id === state.activeConversationId && matches(item))
        || state.conversations.find(matches);
      if (!existing) return createConversation({ projectId: validProjectId, silent, isTemporary: true });
      state.activeConversationId = existing.id;
      if (!silent) { persistSoon(); notify('conversation-selected'); }
      return existing;
    },
    appendMessage(conversationId, message) {
      const conversation = conversationById(conversationId);
      if (!conversation) return null;
      const promoted = isTemporaryConversation(conversation) && message.role === 'user';
      appendToActivePath(conversation, message);
      if (promoted) { conversation.isTemporary = false; touchConversation(conversation); }

      notify("conversation-updated", [
        ...(promoted ? ["conversation-list"] : []),
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
