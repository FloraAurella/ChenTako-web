/** 上下文预算校验（原版 lib/chat-config.ts 移植）：粗估 token，不追求供应商精确计费。 */
type JsonValue = unknown;

export function estimateContextTokens(value: JsonValue): number {
  if (value == null) return 0;
  if (typeof value === 'string') return Math.ceil(value.length / 2);
  if (Array.isArray(value)) return value.reduce<number>((sum, entry) => sum + estimateContextTokens(entry), 0);
  if (typeof value !== 'object') return 1;
  let tokens = 4;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (['source', 'data', 'url', 'image_url'].includes(key)) {
      const type = String((value as Record<string, unknown>).type || '');
      if (['image', 'image_url', 'input_image'].includes(type)) tokens += 4096;
      else if (type === 'file') tokens += Math.max(4096, Math.ceil((Number((entry as Record<string, unknown>)?.size) || String(entry).length * 0.75) / 2));
      continue;
    }
    tokens += estimateContextTokens(entry);
  }
  return tokens;
}

export class ContextBudgetError extends Error {
  code = 'CONTEXT_BUDGET_EXCEEDED';
  constructor(message: string) {
    super(message);
    this.name = 'ContextBudgetError';
  }
}

interface BudgetProvider {
  chatConfigVersion?: number;
  contextWindow?: number;
  maxTokens?: number;
  inputBudget?: number | null;
}

export function enforceContextBudget(provider: BudgetProvider, contents: unknown): void {
  if (provider.chatConfigVersion !== 1) return;
  const available = Math.floor(Number(provider.contextWindow) * 0.95) - Number(provider.maxTokens);
  const budget = provider.inputBudget ?? available;
  if (available < 1 || budget > available) {
    throw new ContextBudgetError('模型输出额度与输入预算冲突，请调整上下文设置。');
  }
  if (estimateContextTokens(contents) > budget) {
    throw new ContextBudgetError('上下文超过输入预算，请压缩历史或调整上下文设置后重试。');
  }
}
