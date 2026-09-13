import { describe, it, expect, vi } from 'vitest';
import { promptText } from '../src/resources/public/prompts.js';
import { resolveChatConfig } from '../src/modules/context/domain/config.js';
import { createWritingOperation } from '../src/modules/writing/services/operation';
import { writingService } from '../src/modules/writing/services/work';

describe('file-owned prompts', () => {
  it('empty system prompt overrides stored defaults and project prompts without deleting them', () => {
    const state = { chatConfig: { systemPrompt: 'old' }, projects: [{ id: 'p', configOverrides: { systemPrompt: 'project' } }] };
    expect(resolveChatConfig(state, { projectId: 'p' }).systemPrompt).toBe('');
    expect(state.chatConfig.systemPrompt).toBe('old');
    expect(promptText('system')).toBe('');
  });
  it('required tasks fail explicitly when empty or invalid', () => {
    expect(() => promptText('continuity', true)).toThrow('prompts/continuity.json');
    expect(() => promptText('missing')).toThrow('JSON');
  });
  it('inactive writing prompt prevents the model call and preserves the chapter', async () => {
    const conversation: any = { id: 'c', messages: [] };
    const store: any = { state: { conversations: [conversation] }, notify() {}, persistSoon() {} };
    const service = writingService(store);
    const c = service.create('c', '第一章');
    conversation.writing.mode = 'write';
    const op = createWritingOperation({ store, conversation })!;
    let called = false;
    await expect(op.prepare!({ request: {} as any, message: {} as any, signal: new AbortController().signal, complete: async () => { called = true; return ''; } })).rejects.toThrow('prompts/write.json');
    op.dispose!();
    expect(called).toBe(false);
    expect(c.body).toBe('');
    expect(service.runtime('c').locks.size).toBe(0);
  });
});

// Tests use explicit empty fixtures, never author-owned prompt text.
vi.mock('../prompts/system.json', () => ({ default: '' }));
vi.mock('../prompts/discussion.json', () => ({ default: '' }));
vi.mock('../prompts/write.json', () => ({ default: '' }));
vi.mock('../prompts/edit.json', () => ({ default: '' }));
vi.mock('../prompts/continuity.json', () => ({ default: '' }));

it('does not expose any writing prompt in the web prompt catalog', () => {
  for (const name of ['discussion', 'write', 'edit', 'continuity']) expect(() => promptText(name)).toThrow();
});
