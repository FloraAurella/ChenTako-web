import { buildPersistentPayload } from '../src/app/state/persistence.js';
import { describe, it, expect, vi } from 'vitest';
import { Scope } from '../src/core/scope';
import { beginFirstResponse, endFirstResponse, isConversationLocked } from '../src/modules/chat/domain/first-response.js';
import { createTitleGeneration, firstInputDescription } from '../src/modules/chat/services/title-generation.js';
import { captureAuxiliaryModel, validateAuxiliaryInput } from '../src/modules/chat/services/auxiliary-models.js';
import { selectRuntimeModel, selectRuntimeEffort } from '../src/modules/chat/services/runtime-selection.js';
import { normalizeConversation } from '../src/contracts/normalize.js';
import { normalizeChatConfig, migrateChatSettings } from '../src/modules/context/domain/config.js';
import { createStore } from '../src/app/state/store.js';
import { exportConversationArchive, importConversationArchive } from '../src/modules/data/domain/archive.js';

const target = { model: 'title', header: { id: 'p' }, limits: { contextWindow: 10000, maxTokens: 1000 } };
function fixture() {
  const store = createStore();
  const conversation = Object.assign(store.createConversation({ silent: true }), { titleRevision: 0 });
  conversation.title = '备用标题';
  const scope = new Scope();
  const toast = vi.fn();
  let resolve!: (response: Response) => void;
  const fetch = vi.fn((_path: string, _options: RequestInit = {}) => new Promise<Response>(r => { resolve = r; }));
  const service = createTitleGeneration({ store, scope, toast, fetch });
  return { store, conversation, scope, toast, fetch, service, resolve: (payload: any) => resolve(new Response(JSON.stringify(payload))) };
}

describe('首次响应与一次性标题', () => {
  it('仅新会话获得一次机会；停止后解锁但不重试，刷新不恢复运行锁', () => {
    const c = normalizeConversation({ messages: [] });
    expect(beginFirstResponse(c)).toBe(true);
    expect(isConversationLocked(c)).toBe(true);
    expect(isConversationLocked(normalizeConversation(c))).toBe(false);
    endFirstResponse(c);
    expect(beginFirstResponse(c)).toBe(false);
    expect(beginFirstResponse(normalizeConversation({ messages: [{ role: 'user', content: '旧会话' }] }))).toBe(false);
    expect(beginFirstResponse(normalizeConversation({ titleGenerationAttempted: true, messages: [] }))).toBe(false);
  });
  it('模型与强度操作、项目移动与删除在领域入口拒绝，结束后可用', () => {
    const f = fixture(); const project = f.store.createProject('测试项目');
    f.store.moveConversationToProject(f.conversation.id, project.id);
    beginFirstResponse(f.conversation);
    const stored = buildPersistentPayload(f.store.state).conversations.find((c: { id: string }) => c.id === f.conversation.id);
    expect(stored).not.toHaveProperty("firstResponsePending");
    expect(stored).not.toHaveProperty("titleRevision");
    expect(stored).toHaveProperty("titleGenerationAttempted", true);
    expect(selectRuntimeModel(f.store, f.conversation, 'missing', 'm').message).toContain('首次响应');
    expect(selectRuntimeEffort(f.store, f.conversation, 'low').status).toBe('unavailable');
    expect(() => f.store.moveConversationToProject(f.conversation.id, null)).toThrow('首次响应');
    expect(() => f.store.deleteProject(project.id)).toThrow('首次响应');
    expect(f.conversation.projectId).toBe(project.id);
    endFirstResponse(f.conversation);
    f.store.deleteProject(project.id);
    expect(f.conversation.projectId).toBe(null);
    f.scope.dispose();
  });
  it('只传首次输入；正常标题写回并规范为单行，附件仅取名称', async () => {
    const f = fixture();
    const task = f.service.generate(f.conversation, '第一次要求', target);
    expect(JSON.parse(String(f.fetch.mock.calls[0][1]?.body))).toEqual({ provider: target.header, model: 'title', input: '第一次要求' });
    f.resolve({ title: '  清晰\n标题  ' }); await task;
    expect(f.conversation.title).toBe('清晰 标题');
    expect(firstInputDescription({ content: '' }, [{ name: '笔记.txt', text: '不会上传附件正文' }])).toBe('笔记.txt');
    f.scope.dispose();
  });
  it('晚到标题不覆盖手动改名，包括用户改回相同名称', async () => {
    const f = fixture(); const task = f.service.generate(f.conversation, '要求', target);
    f.conversation.titleRevision = 1;
    f.resolve({ title: '自动标题' }); await task;
    expect(f.conversation.title).toBe('备用标题'); f.scope.dispose();
  });
  it('删除与释放取消请求，旧结果不写入', async () => {
    for (const mode of ['delete', 'dispose']) {
      const f = fixture(); const task = f.service.generate(f.conversation, '要求', target);
      if (mode === 'dispose') f.scope.dispose();
      else { f.store.state.conversations = []; f.store.notify('conversation-selected'); }
      expect(f.fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
      f.resolve({ title: '失效结果' }); await task;
      expect(f.conversation.title).toBe('备用标题'); expect(f.toast).not.toHaveBeenCalled(); f.scope.dispose();
    }
  });
  it('空标题与无效模型保留备用标题，不发起隐式重试', async () => {
    const f = fixture(); beginFirstResponse(f.conversation);
    const task = f.service.generate(f.conversation, '要求', target);
    f.resolve({ title: '' }); await task;
    expect(f.conversation.title).toBe('备用标题'); expect(f.toast).toHaveBeenCalledOnce();
    expect(beginFirstResponse(f.conversation)).toBe(false);
    await f.service.generate(f.conversation, '要求', { error: '专用模型已不可用' });
    expect(f.fetch).toHaveBeenCalledOnce(); f.scope.dispose();
  });
  it('导出导入保留机会状态，去除运行锁', async () => {
    const f = fixture(); beginFirstResponse(f.conversation);
    const { bytes } = exportConversationArchive(f.conversation);
    const restored = await importConversationArchive({ name: 'test.zip', arrayBuffer: async () => bytes.buffer }, []);
    expect(restored).toMatchObject({ titleGenerationAttempted: true });
    expect(isConversationLocked(restored)).toBe(false);
    expect(beginFirstResponse(restored)).toBe(false); f.scope.dispose();
  });
});

describe('专用模型与兼容配置', () => {
  it('旧预算和开关仅保留在白名单备份，阈值与项目模型覆盖保留', () => {
    const migrated = migrateChatSettings({ settingsSchemaVersion: 1, chatConfig: { inputBudget: 1000, autoCompress: false, compressionThreshold: 65 }, projects: [{ id: 'p', configOverrides: { inputBudget: 10, autoCompress: true } }] });
    expect(migrated.chatConfig).toMatchObject({ compressionThreshold: 65, titleModel: null, compressionModel: null });
    expect(migrated.chatConfig).not.toHaveProperty('inputBudget');
    if (!("contextPolicy" in migrated.legacySettingsBackup)) throw new Error("缺少兼容备份");
    expect(migrated.legacySettingsBackup.contextPolicy).toEqual({ defaults: { inputBudget: 1000, autoCompress: false }, projects: [{ id: 'p', inputBudget: 10, autoCompress: true }] });
    expect(migrateChatSettings(migrated).legacySettingsBackup).toMatchObject({ contextPolicy: migrated.legacySettingsBackup.contextPolicy });
    expect(normalizeChatConfig({ titleModel: { providerId: 'p', model: 'm', apiKey: 'discard' } }, true)).toEqual({ titleModel: { providerId: 'p', model: 'm' } });
  });
  it('独立供应商模型快照不含凭据，不跟随后续配置变化，无效选择不回退', () => {
    const provider = { id: 'p', models: ['m'], enabled: true, contextWindow: 10000, maxTokens: 1000, apiKey: 'never-copy' };
    const captured = captureAuxiliaryModel({ providers: [provider] }, { providerId: 'p', model: 'm' }, null, 'other');
    provider.contextWindow = 10;
    if (!("limits" in captured)) throw new Error(captured.error);
    expect(captured.limits.contextWindow).toBe(10000);
    expect(JSON.stringify(captured)).not.toContain('never-copy');
    expect(captureAuxiliaryModel({ providers: [] }, { providerId: 'missing', model: 'm' }, provider, 'm')).toMatchObject({ error: expect.any(String) });
    expect(() => validateAuxiliaryInput(target, '长文本'.repeat(10000))).toThrow('窗口不足');
  });
});
