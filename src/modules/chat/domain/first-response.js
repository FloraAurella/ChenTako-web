export const FIRST_RESPONSE_LOCK_REASON = '首次响应尚未结束，请等待完成或停止生成后再修改对话。';

// Runtime-only: normalization deliberately drops this flag after reload.
export function isConversationLocked(conversation) {
  return conversation?.firstResponsePending === true;
}

export function beginFirstResponse(conversation) {
  if (conversation.titleGenerationAttempted || conversation.messages.some(message => !message.noticeKind)) return false;
  conversation.titleGenerationAttempted = true;
  conversation.firstResponsePending = true;
  return true;
}

export function endFirstResponse(conversation) {
  conversation.firstResponsePending = false;
}
