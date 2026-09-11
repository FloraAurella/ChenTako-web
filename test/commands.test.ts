import { describe, expect, it, vi } from 'vitest';
import { parseCommandInput } from '../src/modules/commands/domain/parser';
import { chatCommands } from '../src/modules/chat/services/commands';
import type { CommandContext } from '../src/contracts/commands';
import { createComposition } from '../src/app/composition';
import { selectRuntimeModel, selectRuntimeEffort } from '../src/modules/chat/services/runtime-selection.js';

const context = (): CommandContext => ({
  conversationId: 'c', models: [
    { providerId: 'a', providerName: '供应商 A', model: 'same', selected: true },
    { providerId: 'b', providerName: '供应商 B', model: 'same', selected: false },
    { providerId: 'a', providerName: '供应商 A', model: 'unique', selected: false }
  ], effort: 'medium', followsConfig: true, busy: false, compactUnavailable: null,
  selectModel: vi.fn(() => ({ status: 'success' as const, message: 'model' })),
  selectEffort: vi.fn(() => ({ status: 'success' as const, message: 'effort' })),
  compact: vi.fn(async () => ({ status: 'success' as const, message: 'compressed' }))
});
const command = (id: string) => chatCommands.find(item => item.id === id)!;
describe('command parsing and ownership', () => {
  it.each(['路径 /model', '```\n/model\n```', '/model\n正文', '/model\r\n正文', '/model\u2028正文', '/model\u2029正文', 'https://example.com'])('preserves ordinary text: %s', text => {
    expect(parseCommandInput(text)).toEqual({ kind: 'message', text });
  });
  it('normalizes command names without rewriting model identifiers', () => {
    expect(parseCommandInput(' /MoDeL Provider/Case-Sensitive ')).toMatchObject({ kind: 'command', name: 'model', argument: 'Provider/Case-Sensitive' });
    expect(parseCommandInput('/model\u00a0model-a')).toMatchObject({ kind: 'command', name: 'model', argument: 'model-a' });
    expect(parseCommandInput('/未知')).toMatchObject({ kind: 'command', name: '未知' });
  });
  it('unescapes one slash only for a single-line literal', () => {
    expect(parseCommandInput('//model')).toEqual({ kind: 'message', text: '/model' });
    expect(parseCommandInput('///abc')).toEqual({ kind: 'message', text: '//abc' });
    expect(parseCommandInput('//a\nb')).toEqual({ kind: 'message', text: '//a\nb' });
  });
  it('registers all four commands and disposes their contributions', () => {
    const composition = createComposition();
    expect(composition.contributions.commands.list().map(c => c.id).sort()).toEqual(['compact', 'effort', 'help', 'model']);
    composition.dispose(); expect(composition.contributions.commands.list()).toEqual([]);
  });
});
describe('command actions', () => {
  it('executes only unique exact model matches', async () => {
    const ctx = context();
    expect(await command('model').execute(ctx, 'unique')).toMatchObject({ status: 'success' });
    expect(ctx.selectModel).toHaveBeenCalledWith('a', 'unique');
  });
  it('disambiguates identical model names by provider ID', async () => {
    const ctx = context(); const result = await command('model').execute(ctx, 'same');
    expect(result.status).toBe('select'); expect(ctx.selectModel).not.toHaveBeenCalled();
    if (result.status === 'select') {
      expect(result.options).toHaveLength(2); expect(result.options[0].id).not.toBe(result.options[1].id);
      await result.options[1].choose(); expect(ctx.selectModel).toHaveBeenCalledWith('b', 'same');
    }
  });
  it('partial and missing matches never auto-select', async () => {
    const ctx = context();
    expect(await command('model').execute(ctx, 'uni')).toMatchObject({ status: 'select', options: [{ label: 'unique' }] });
    expect(await command('model').execute(ctx, 'missing')).toMatchObject({ status: 'select', options: [] });
    expect(ctx.selectModel).not.toHaveBeenCalled();
  });
  it.each([['low', 'low'], ['中等', 'medium'], ['HIGH', 'high'], ['极高', 'xhigh'], ['最大', 'max'], ['default', null], ['跟随配置', null]])('accepts effort %s', async (argument, value) => {
    const ctx = context(); await command('effort').execute(ctx, argument!); expect(ctx.selectEffort).toHaveBeenCalledWith(value);
  });
  it('rejects invalid parameters without mutations', async () => {
    const ctx = context();
    expect(await command('effort').execute(ctx, 'typo')).toMatchObject({ status: 'error' });
    expect(await command('compact').execute(ctx, 'extra')).toMatchObject({ status: 'error' });
    expect(ctx.compact).not.toHaveBeenCalled(); expect(ctx.selectEffort).not.toHaveBeenCalled();
    ctx.compactUnavailable = '正在回复'; expect(command('compact').available(ctx)).toBe('正在回复');
  });
  it('validates a stale model selection at mutation time', () => {
    const store = { state: { providers: [{ id: 'a', models: ['unique'], enabled: false }] }, persistSoon: vi.fn(), notify: vi.fn() };
    const conversation = { providerId: 'a', model: 'old' };
    expect(selectRuntimeModel(store, conversation, 'a', 'unique')).toMatchObject({ status: 'unavailable' });
    expect(conversation.model).toBe('old'); expect(store.persistSoon).not.toHaveBeenCalled();
  });
  it('shares original effort memory semantics', () => {
    const store = { state: { chatConfig: { defaultReasoningEffort: 'medium' } }, persistSoon: vi.fn() };
    const conversation: any = {};
    selectRuntimeEffort(store, conversation, 'high');
    expect(conversation.reasoningEffortOverride).toBe('high');
    expect((store.state as any).preferredReasoningEffort).toBe('high');
    selectRuntimeEffort(store, conversation, null);
    expect(conversation.reasoningEffortOverride).toBeNull();
  });
});
