// @vitest-environment node
import { it, expect, vi } from 'vitest';
import { taskPrompt } from '../../server/modules/chat/services/prompt-files.ts';
it('empty auxiliary prompts never silently fall back to embedded instructions', () => {
  expect(() => taskPrompt('summary')).toThrow('prompts/summary.json');
  expect(() => taskPrompt('title')).toThrow('prompts/title.json');
});

vi.mock('node:fs', () => ({ readFileSync: () => '""' }));
