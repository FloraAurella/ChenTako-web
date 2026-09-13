import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createStore } from '../src/app/state/store.js';
import { normalizeConversation } from '../src/contracts/normalize.js';
import { buildPersistentPayload, buildLightweightPayload } from '../src/app/state/persistence.js';
import { isTemporaryConversation } from '../src/modules/chat/domain/queries.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
describe('待发送会话生命周期', () => {
  it('反复新建复用草稿；项目之间隔离，历史会话不被修改', () => {
    const store = createStore();
    const legacy = store.createConversation({ silent: true });
    const draft = store.actions.openTemporaryConversation();
    draft.draft = '未发送文字';
    expect(store.actions.openTemporaryConversation()).toBe(draft);
    expect(draft.draft).toBe('未发送文字');
    expect(isTemporaryConversation(legacy)).toBe(false);
    store.state.projects = [{ id: 'p', name: '项目' }];
    const projectDraft = store.actions.openTemporaryConversation({ projectId: 'p' });
    expect(projectDraft.id).not.toBe(draft.id);
    expect(projectDraft.projectId).toBe('p');
    expect(store.actions.openTemporaryConversation({ projectId: null })).toBe(draft);
    projectDraft.projectId = null;
    store.state.activeConversationId = projectDraft.id;
    expect(store.actions.openTemporaryConversation()).toBe(projectDraft);
    store.actions.appendMessage(projectDraft.id, { id: 'sent', role: 'user', content: '发言' });
    expect(store.actions.openTemporaryConversation()).toBe(draft);
    expect(draft.draft).toBe('未发送文字');
  });
  it('第一条用户消息才转正、只通知一次历史加入；后续删空消息不降回临时', () => {
    const store = createStore();
    const draft = store.actions.openTemporaryConversation();
    const listener = vi.fn(); store.subscribeKey('conversation-list', listener);
    store.actions.appendMessage(draft.id, { id: 'u', role: 'user', content: '你好' });
    expect(draft.isTemporary).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    store.actions.appendMessage(draft.id, { id: 'a', role: 'assistant', content: '' });
    expect(listener).toHaveBeenCalledTimes(1);
    draft.messages = [];
    expect(isTemporaryConversation(draft)).toBe(false);
  });
  it('完整及降级备份保留临时标记、项目与草稿，旧数据缺省仍是历史', () => {
    const store = createStore();
    const draft = store.actions.openTemporaryConversation(); draft.draft = '刷新后继续';
    for (const payload of [buildPersistentPayload(store.state), buildLightweightPayload(buildPersistentPayload(store.state))]) {
      const restored = normalizeConversation(payload.conversations[0]);
      expect(restored.isTemporary).toBe(true); expect(restored.draft).toBe('刷新后继续');
      expect(payload.activeConversationId).toBe(draft.id);
    }
    expect(normalizeConversation({ messages: [] }).isTemporary).toBe(false);
    expect(normalizeConversation({ isTemporary: true, messages: [{ role: 'user', content: '已发言' }] }).isTemporary).toBe(false);
  });
});
