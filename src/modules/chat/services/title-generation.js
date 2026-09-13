import { AUXILIARY_CHAT_ROUTES } from '../../../contracts/auxiliary';
import { apiFetch } from '../../../shared/api.js';
import { LIMITS } from '../../../contracts/constants.js';
import { validateAuxiliaryInput } from './auxiliary-models.js';

export function firstInputDescription(message, attachments = []) {
  return String(message.content || '').trim() || attachments.map(item => item.name).filter(Boolean).join('、') || '附件对话';
}

export function createTitleGeneration({ store, scope, toast, fetch = apiFetch }) {
  const pending = new Map();
  scope.defer(() => { for (const abort of pending.values()) abort.abort(); pending.clear(); });
  scope.defer(store.subscribe(() => {
    for (const [conversation, abort] of pending) {
      if (!store.state.conversations.includes(conversation)) { abort.abort(); pending.delete(conversation); }
    }
  }));
  async function generate(conversation, input, target) {
    if (pending.has(conversation) || scope.disposed) return;
    const abort = new AbortController();
    pending.set(conversation, abort);
    const originalTitle = conversation.title;
    const revision = conversation.titleRevision || 0;
    try {
      validateAuxiliaryInput(target, { messages: [{ role: 'user', content: input }] });
      const response = await fetch(AUXILIARY_CHAT_ROUTES.title, { method: 'POST', signal: abort.signal,
        body: JSON.stringify({ provider: target.header, model: target.model, input }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      if (typeof payload.title !== 'string') throw new Error('标题模型返回了无效标题');
      const title = String(payload.title || '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.titleLength);
      if (!title) throw new Error('标题模型返回了空标题');
      if (scope.disposed || abort.signal.aborted || !store.state.conversations.includes(conversation) || conversation.title !== originalTitle || (conversation.titleRevision || 0) !== revision) return;
      conversation.title = title;
      store.persistSoon();
      store.notify('conversation-renamed');
    } catch (error) {
      if (!scope.disposed && !abort.signal.aborted && store.state.conversations.includes(conversation)) toast(`标题生成失败：${error.message}；已保留首次输入标题，不会自动重试。`, { tone: 'danger' });
    } finally { pending.delete(conversation); }
  }
  return { generate };
}
