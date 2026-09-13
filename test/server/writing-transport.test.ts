// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseChatConfig } from '../../server/modules/chat/domain/chat-config';
import { LIMITS } from '../../server/contracts/limits';
const config = { version: 1, systemPrompt: '', userId: '', temperature: 0.7, topP: 1, inputBudget: null, reasoningEffort: 'medium', streaming: false };
describe('全文写作请求传输边界', () => {
  it('preserves fixed manuscript context beyond the settings prompt limit', () => {
    const text = '完整章节正文'.repeat(30000);
    expect(parseChatConfig({ ...config, systemPrompt: text })?.systemPrompt).toBe(text);
  });
  it('rejects oversized fixed context without truncation', () => {
    expect(() => parseChatConfig({ ...config, systemPrompt: 'x'.repeat(LIMITS.requestSystemPromptChars + 1) })).toThrow('过长');
  });
});
