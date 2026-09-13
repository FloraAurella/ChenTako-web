import { describe, expect, it, vi } from 'vitest';
import { newWork, normalizeWork, parseContinuity, workContext } from '../src/modules/writing/domain/work';
import { writingService } from '../src/modules/writing/services/work';
import { createWritingOperation } from '../src/modules/writing/services/operation';
import { parseCommandInput } from '../src/modules/commands/domain/parser';
import { normalizeConversation } from '../src/contracts/normalize.js';
import { buildLightweightPayload, buildPersistentPayload } from '../src/app/state/persistence.js';
import { createComposition } from '../src/app/composition';
import { contextMessages } from '../src/modules/chat/domain/queries.js';
import { exportConversationArchive, importConversationArchive } from '../src/modules/data/domain/archive.js';

vi.mock('../src/resources/public/prompts.js', () => ({ promptText: (name: string) => `测试提示词 ${name}` }));

function fixture() {
  const conversation = { id: 'c', isTemporary: true, saveChats: true, writing: newWork(), projectId: 'p', messages: [] };
  const store: any = { state: { conversations: [conversation], projectKnowledge: {} }, notify: vi.fn(), persist: vi.fn(async () => true), persistSoon: vi.fn() };
  const service = writingService(store);
  const chapters = ['Chapter5', 'Chapter6', 'Chapter7'].map(name => service.create('c', name));
  for (const [i, c] of chapters.entries()) { service.draft('c', c.id, `正文${i + 5}`); service.accept('c', c.id); }
  service.select('c', chapters[1].id);
  return { conversation, store, service, chapters };
}
describe('作品与版本', () => {
  it('promotes an empty conversation and isolates candidate acceptance from adjacent chapters', () => {
    const { service, conversation, chapters } = fixture();
    expect(conversation.isTemporary).toBe(false);
    service.draft('c', chapters[1].id, '新正文6');
    expect(chapters[1].body).toBe('正文6');
    service.accept('c', chapters[1].id);
    expect(chapters.map(c => c.body)).toEqual(['正文5', '新正文6', '正文7']);
    service.restore('c', chapters[1].id, chapters[1].versions[0].id);
    expect(chapters[1].body).toBe('正文6'); expect(chapters[1].versions).toHaveLength(3);
  });
  it('retains candidate history, rejects duplicate names, and resets deleted selection', () => {
    const { service, conversation, chapters } = fixture();
    expect(() => service.create('c', 'Chapter6')).toThrow('已存在');
    service.draft('c', chapters[1].id, '初稿'); service.draft('c', chapters[1].id, '改稿');
    const previous = chapters[1].drafts.find(d => d.text === '初稿')!;
    service.restore('c', chapters[1].id, previous.id, true);
    expect(chapters[1].candidate?.text).toBe('初稿');
    service.mode('c', 'edit'); service.remove('c', chapters[1].id);
    expect(conversation.writing).toMatchObject({ mode: 'edit', selectedId: null });
  });
  it('round trips full work and marks interrupted drafts incomplete without truncation', () => {
    const { service, conversation, chapters } = fixture();
    const id = service.begin('c', chapters[1].id); service.update('c', chapters[1].id, id, '长正文'.repeat(20000));
    const restored = normalizeConversation(JSON.parse(JSON.stringify(conversation)));
    expect(restored.writing!.chapters[1].candidate!.text.length).toBe(60000);
    expect(restored.writing!.chapters[1].candidate!.status).toBe('incomplete');
    expect(normalizeConversation({ messages: [] }).writing).toBeNull();
  });
  it('retains invalid and future work for recovery and blocks incomplete context', () => {
    for (const bad of [{ version: 99, text: '保留' }, { ...newWork(), chapters: [{ name: '丢失正文' }] }]) {
      const normalized = normalizeWork(bad)!; expect(normalized.recovery).toEqual(bad); expect(workContext(normalized).error).toBeTruthy();
    }
  });
  it('reports storage failure while retaining all manuscript data', async () => {
    const { service, store, chapters } = fixture();
    store.persist.mockResolvedValue(false); await service.save('c');
    expect(service.runtime('c').unsaved).toBe(true); expect(chapters[1].body).toBe('正文6');
    store.persist.mockResolvedValue(true); await service.save('c'); expect(service.runtime('c').unsaved).toBe(false);
  });
  it('includes work in complete and lightweight persistence payloads', () => {
    const { conversation } = fixture();
    const payload = buildPersistentPayload({ conversations: [conversation], providers: [], projects: [], activeConversationId: 'c', chatConfig: {}, modelCompatibility: {}, projectKnowledge: {}, sidebar: {} } as any);
    expect(payload.conversations[0].writing).toEqual(conversation.writing);
    expect(buildLightweightPayload(payload).conversations[0].writing).toEqual(conversation.writing);
  });
  it('saves explicit manuscripts while respecting disabled chat-history saving', () => {
    const { conversation } = fixture(); conversation.saveChats = false;
    const payload = buildPersistentPayload({ conversations: [{ ...conversation, messages: [{ id: 'private', role: 'user', content: '不保存聊天' }] }], providers: [], projects: [], activeConversationId: 'c', chatConfig: {}, modelCompatibility: {}, projectKnowledge: {}, sidebar: {} } as any);
    expect(payload.conversations[0].messages).toEqual([]); expect(payload.conversations[0].writing).toEqual(conversation.writing);
  });
  it('round trips manuscript, versions and candidate drafts through the existing ZIP archive', async () => {
    const { service, conversation, chapters } = fixture(); service.draft('c', chapters[1].id, '未采纳版本');
    const { bytes } = exportConversationArchive(conversation);
    const imported = await importConversationArchive(new File([bytes], "writing.ChenTako.zip"));
    expect((imported as any).writing).toEqual(conversation.writing);
  });
  it('uses a context receipt instead of treating unaccepted assistant prose as accepted history', () => {
    const c = normalizeConversation({ messages: [{ id: 'u', role: 'user', content: '写一章' }, { id: 'a', role: 'assistant', content: '未采纳稿', contextText: '候选稿回执' }] });
    expect(contextMessages(c)).toEqual([{ role: 'user', content: '写一章' }, { role: 'assistant', content: '候选稿回执' }]);
    expect(c.messages[1].content).toBe('未采纳稿');
  });
});
describe('写作请求生命周期', () => {
  it('captures all accepted chapters and only the selected candidate', () => {
    const { service, conversation, chapters } = fixture();
    service.draft('c', chapters[0].id, '不应携带的候选'); service.draft('c', chapters[1].id, '当前编辑底稿');
    const text = workContext(conversation.writing).text;
    for (const c of chapters) expect(text).toContain(c.body);
    expect(text).toContain('当前编辑底稿'); expect(text).not.toContain('不应携带的候选');
  });
  it('locks and streams directly into body without acceptance', async () => {
    const { service, conversation, store, chapters } = fixture(); service.mode('c', 'edit');
    const op = createWritingOperation({ store, conversation })!;
    await op.prepare({ request: {}, message: {}, signal: new AbortController().signal, complete: vi.fn(async () => '{"conflicts":[]}') });
    expect(() => service.remove('c', chapters[1].id)).toThrow('正在');
    op.start(); op.update('流式正文');
    expect(chapters[1].body).toBe('流式正文'); expect(chapters[1].versions.at(-1)?.status).toBe('generating');
    op.finish({ text: '完整正文', complete: true }); op.dispose();
    expect(chapters[1].body).toBe('完整正文');
  });
  it('does not call a strict continuity gate and preserves arbitrary prose verbatim', async () => {
    const { service, conversation, store, chapters } = fixture(); service.mode('c', 'edit');
    const check = vi.fn(); const op = createWritingOperation({ store, conversation })!;
    await op.prepare({ request: {}, message: { content: '随便写' }, signal: new AbortController().signal, complete: check });
    expect(check).not.toHaveBeenCalled(); op.start();
    const text = '说明\n```markdown\n# 第一章\n正文\n```';
    op.finish({text, complete:true}); op.dispose();
    expect(chapters[1].body).toBe(text); expect(op.outputSurface).toBe('workspace');
  });
  it('invalidates preparation after changes and retains partial output on cancellation', async () => {
    const { service, conversation, store, chapters } = fixture(); service.mode('c', 'edit');
    const op = createWritingOperation({ store, conversation })!;
    await op.prepare({ request: {}, message: {}, signal: new AbortController().signal, complete: async () => '{"conflicts":[]}' });
    service.rename('c', chapters[0].id, '前章新名'); expect(() => op.validate()).toThrow('已变化'); op.dispose();
    const next = createWritingOperation({ store, conversation })!;
    await next.prepare({ request: {}, message: {}, signal: new AbortController().signal, complete: async () => '{"conflicts":[]}' });
    next.start(); next.finish({ text: '部分', complete: false }); next.dispose();
    expect(chapters[1].versions.at(-1)).toMatchObject({ text: '部分', status: 'incomplete' });
    expect(chapters[1].body).toBe('部分');
    next.update('迟到'); expect(chapters[1].body).toBe('部分');
  });
  it('cleans all optional writing contributions without deleting data', () => {
    const composition = createComposition(['writing']);
    expect(composition.contributions.commands.get('write')).toBeUndefined();
    expect(composition.contributions.slots.list().some(s => s.id.startsWith('writing.'))).toBe(false);
    composition.dispose();
  });
});
describe('输入与检查格式', () => {
  it('parses chapter prefixes, quoted names and multiline bodies, preserving legacy multiline text', () => {
    expect(parseCommandInput('@"雨夜 重逢" /EDIT 第一行\n第二行', ['edit'])).toMatchObject({ kind: 'command', name: 'edit', target: '雨夜 重逢', argument: '第一行\n第二行' });
    expect(parseCommandInput('@不存在')).toMatchObject({ kind: 'command', name: '@' });
    expect(parseCommandInput('/model\n正文')).toMatchObject({ kind: 'message' });
    expect(parseCommandInput('正文 @Chapter6 /write')).toMatchObject({ kind: 'message' });
    expect(parseCommandInput('@@someone')).toEqual({ kind: 'message', text: '@someone' });
  });
  it('requires exactly the declared conflict JSON shape', () => {
    expect(parseContinuity('{"conflicts":[]}')).toEqual([]);
    for (const text of ['{}', 'null', '{"conflicts":[null]}', '{"conflicts":[],"body":"意外正文"}']) expect(() => parseContinuity(text)).toThrow('格式');
  });
});

describe('直接正文工作区', () => {
  it('keeps mode across creation, selection, version navigation and panel collapse', () => {
    const {service, conversation, chapters} = fixture(); service.mode('c','write');
    service.create('c','新章'); service.select('c',chapters[1].id);
    service.saveBody('c',chapters[1].id,'第一稿'); const first=chapters[1].currentVersionId!;
    service.saveBody('c',chapters[1].id,'第二稿'); service.selectVersion('c',chapters[1].id,first);
    service.togglePanel('c');
    const loaded=normalizeWork(conversation.writing)!;
    expect(loaded).toMatchObject({mode:'write',collapsed:true}); expect(loaded.chapters[1].body).toBe('第一稿');
    service.mode('c','chat'); expect(conversation.writing.mode).toBe('chat');
  });
  it('migrates legacy candidate and previous drafts without losing official body', () => {
    const {service,conversation,chapters}=fixture(); delete conversation.writing.workspaceVersion;
    // Build old serialized data directly, so mutation services cannot migrate it first.
    chapters[1].candidate={id:'candidate',text:'最新旧稿',createdAt:1,source:'old',status:'generating'};
    chapters[1].drafts=[{id:'draft',text:'早期旧稿',createdAt:0,source:'old',status:'complete'}];
    const migrated=normalizeWork(conversation.writing)!; const c=migrated.chapters[1];
    expect(c.body).toBe('最新旧稿'); expect(c.candidate).toBeNull(); expect(c.drafts).toEqual([]);
    expect(c.versions.map(v=>v.text)).toEqual(expect.arrayContaining(['正文6','早期旧稿','最新旧稿']));
    expect(normalizeWork(migrated)).toEqual(migrated);
  });
  it('empty or failed generation retains prior body and a recoverable failed version', () => {
    const {service,chapters}=fixture(); const id=service.beginBody('c',chapters[1].id,'要求');
    service.updateBody('c',chapters[1].id,id,'','incomplete');
    expect(chapters[1].body).toBe('正文6'); expect(chapters[1].versions.at(-1)).toMatchObject({text:'',status:'incomplete'});
  });
  it('persists output destination so writing messages stay out of the chat after reload', () => {
    const c=normalizeConversation({messages:[{id:'u',role:'user',content:'要求',outputSurface:'workspace'},{id:'a',role:'assistant',content:'正文',outputSurface:'workspace',contextText:'回执'}]});
    expect(c.messages.every(m=>m.outputSurface==='workspace')).toBe(true);
    expect(contextMessages(c)).toEqual([{role:'user',content:'要求'},{role:'assistant',content:'回执'}]);
  });
});

it('mode selection persists even before the first chapter is created', () => {
  const c:any={id:'new',isTemporary:true,messages:[]};const store:any={state:{conversations:[c]},notify:vi.fn(),persist:vi.fn(async()=>true)};
  writingService(store).mode('new','write');expect(c.isTemporary).toBe(false);
  expect(normalizeConversation(c).writing!.mode).toBe('write');
});
it('old writing receipts move to the workspace but ordinary conversation stays visible', () => {
  const writing=newWork();
  const c=normalizeConversation({writing,messages:[{id:'u',role:'user',content:'写作要求'},{id:'a',role:'assistant',content:'旧正文',contextText:'本轮结果为未采纳候选稿；正式正文和当前编辑底稿以本次固定上下文为准。'},{id:'chat',role:'user',content:'讨论'}]});
  expect(c.messages.slice(0,2).every(m=>m.outputSurface==='workspace')).toBe(true);
  expect(c.messages[2].outputSurface).toBeUndefined();expect(c.messages[1].content).toBe('旧正文');
});

describe('/name 重命名指令', () => {
  it('保留稳定 ID、正文、版本、选章和模式，支持中文与引号', async () => {
    const { writingCommands } = await import('../src/modules/writing/services/commands');
    const cmd = writingCommands.find(c => c.id === 'name')!;
    const { service, store, chapters, conversation } = fixture();
    service.mode('c', 'write');
    const original = JSON.stringify(chapters[1].versions);
    const ctx = { store, conversationId: 'c', busy: false } as any;
    cmd.execute(ctx, 'Chapter6 "雨夜 重逢"');
    expect(chapters[1].name).toBe('雨夜 重逢');
    expect(chapters[1].body).toBe('正文6');
    expect(JSON.stringify(chapters[1].versions)).toBe(original);
    expect(conversation.writing).toMatchObject({ selectedId: chapters[1].id, mode: 'write' });
    cmd.execute(ctx, '"雨夜 重逢" "雨夜\\\"重逢"');
    expect(chapters[1].name).toBe('雨夜"重逢');
  });
  it('拒绝参数错误、重名、不存在的章节及编辑和生成锁', async () => {
    const { writingCommands } = await import('../src/modules/writing/services/commands');
    const cmd = writingCommands.find(c => c.id === 'name')!;
    const { service, store, chapters } = fixture();
    const ctx = { store, conversationId: 'c', busy: false } as any;
    for (const argument of ['', 'Chapter6', 'Chapter6 a b', '"Chapter6 b', 'Chapter6 ""']) {
      expect(() => cmd.execute(ctx, argument)).toThrow();
    }
    expect(() => cmd.execute(ctx, '不存在 新名字')).toThrow('没有找到');
    expect(() => cmd.execute(ctx, 'Chapter6 Chapter5')).toThrow('已存在');
    service.runtime('c').editing = true;
    expect(() => cmd.execute(ctx, 'Chapter6 新名字')).toThrow();
    service.runtime('c').editing = false;
    service.runtime('c').locks.add(chapters[1].id);
    expect(() => cmd.execute(ctx, 'Chapter6 新名字')).toThrow();
    expect(chapters[1].name).toBe('Chapter6');
    expect(cmd.available({ ...ctx, busy: true })).toBeTruthy();
  });
});

it('web 默认停用全部写作贡献但保留作品数据的归档兼容', () => {
  const app = createComposition();
  expect(app.contributions.commands.list().map(c => c.id)).not.toContain('write');
  expect(app.contributions.slots.list().some(c => c.id.startsWith('writing.'))).toBe(false);
  expect(app.contributions.requestContexts.get('writing.fulltext')).toBeUndefined();
  const { conversation } = fixture();
  const before = JSON.stringify(conversation.writing);
  expect(normalizeConversation(JSON.parse(JSON.stringify(conversation))).writing?.chapters).toHaveLength(3);
  expect(JSON.stringify(conversation.writing)).toBe(before);
  app.dispose();
});
