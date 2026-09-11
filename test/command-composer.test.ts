import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Registry } from '../src/core/registry';
import { createComposerCommands } from '../src/modules/commands/services/composer';
import type { CommandContext, CommandContribution, CommandResult } from '../src/contracts/commands';

let input: HTMLTextAreaElement;
let instance: ReturnType<typeof createComposerCommands>;
let current: CommandContext | null;
let registry: Registry<CommandContribution>;
const success = { status: 'success', message: '操作成功' } as const;
beforeEach(() => {
  document.body.innerHTML = '<div class="composer-inner"><textarea id="composerInput"></textarea></div>';
  input = document.querySelector('textarea')!;
  Element.prototype.scrollIntoView = vi.fn();
  current = { conversationId: 'one', models: [], effort: 'medium', followsConfig: true, busy: false, compactUnavailable: null,
    selectModel: () => success, selectEffort: () => success, compact: async () => success };
  registry = new Registry();
  instance = createComposerCommands({ input, registry, context: () => current, beforeOpen: vi.fn() });
});
afterEach(() => { instance.dispose(); document.body.innerHTML = ''; vi.restoreAllMocks(); });
function fill(value: string) { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }
function register(execute: CommandContribution['execute']) {
  registry.register('fixture', { id: 'fixture', name: 'fixture', description: '注入的测试能力', parameters: '', available: () => null, execute });
}
describe('generic command composer coordination', () => {
  it('uses registered actions without feature-specific routing', async () => {
    const action = vi.fn(() => success); register(action); fill('/fixture'); await instance.submit();
    expect(action).toHaveBeenCalledOnce(); expect(input.value).toBe('');
    expect(document.querySelector('.command-feedback')?.textContent).toBe('操作成功');
  });
  it('does not clear a newer input even if the original text is typed again', async () => {
    let resolve!: (result: CommandResult) => void;
    register(() => new Promise(done => { resolve = done; })); fill('/fixture');
    const pending = instance.submit(); fill('new'); fill('/fixture'); resolve(success); await pending;
    expect(input.value).toBe('/fixture'); expect(document.querySelector('.command-feedback')?.hasAttribute('hidden')).toBe(true);
  });
  it('does not display or clear results in another conversation', async () => {
    let resolve!: (result: CommandResult) => void;
    register(() => new Promise(done => { resolve = done; })); fill('/fixture');
    const pending = instance.submit(); current = { ...current!, conversationId: 'two' }; instance.synchronize();
    input.value = 'another draft'; resolve(success); await pending;
    expect(input.value).toBe('another draft'); expect(document.querySelector('.command-feedback')?.hasAttribute('hidden')).toBe(true);
  });
  it('handles exceptions without leaking text into ordinary submission', async () => {
    register(() => { throw new Error('可重试失败'); }); fill('/fixture');
    expect(await instance.submit()).toBe(true); expect(input.value).toBe('/fixture');
    expect(document.querySelector('.command-feedback')?.textContent).toBe('可重试失败');
    fill('ordinary /fixture'); expect(await instance.submit()).toBe(false);
  });
  it('marks unavailable commands without invoking their action', async () => {
    const execute = vi.fn(() => success);
    registry.register('fixture', { id: 'fixture', name: 'fixture', description: '', parameters: '', available: () => '当前不可用', execute });
    fill('/fixture'); await instance.submit(); expect(execute).not.toHaveBeenCalled(); expect(input.value).toBe('/fixture');
  });
  it('preserves explicit selection identity and rejects it after navigation', async () => {
    const choose = vi.fn(() => success);
    register(() => ({ status: 'select', title: '选择', options: [{ id: 'unique', label: '同名', detail: '供应商', argument: 'same', choose }] }));
    fill('/fixture'); await instance.submit();
    current = { ...current!, conversationId: 'two' };
    (document.querySelector('[role="option"]') as HTMLElement).click();
    expect(choose).not.toHaveBeenCalled();
  });
});

it('does not clear a restored command after switching away and back during execution', async () => {
  let resolve!: (result: CommandResult) => void;
  register(() => new Promise(done => { resolve = done; }));
  input.value = '/fixture'; // Restored draft: no input event and no open panel.
  const pending = instance.submit();
  current = { ...current!, conversationId: 'two' }; instance.synchronize();
  current = { ...current!, conversationId: 'one' }; instance.synchronize();
  resolve(success); await pending; expect(input.value).toBe('/fixture');
});

it('ignores late results and removes listeners and panel on dispose', async () => {
  let resolve!: (result: CommandResult) => void;
  register(() => new Promise(done => { resolve = done; })); fill('/fixture');
  const pending = instance.submit(); instance.dispose(); resolve(success); await pending;
  fill('/fixture'); expect(document.querySelector('.command-panel-host')).toBeNull();
  expect(input.value).toBe('/fixture');
});
