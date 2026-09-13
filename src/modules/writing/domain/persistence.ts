/** Explicit manuscripts survive disabling ordinary chat-history saving. */
export function hasPersistentWork(conversation: any): boolean { return Boolean(conversation.writing); }
export function projectWorkPersistence(conversation: any, saveChats: boolean | undefined) {
  return hasPersistentWork(conversation) && saveChats === false
    ? { ...conversation, messages: [], draft: '', activeRootMessageId: '', activeChildByMessageId: {}, contextCompression: null }
    : conversation;
}
