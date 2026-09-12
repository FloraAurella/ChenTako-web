import type { EffortKey, ResponseFormat } from '../../../contracts/limits.ts';

/**
 * 思考强度映射层（原版 lib/effort.ts 移植）。
 * 前端五档 low/medium/high/xhigh/max；历史 none 表示不携带推理参数。
 * 各协议表达不同：openai 系 reasoning_effort 三档、anthropic budget_tokens、
 * google thinkingConfig.thinkingBudget。
 */
type ReasoningLevel = Exclude<EffortKey, 'none'>;

export interface ThinkingConfig {
  enabled: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
  budgetTokens?: number;
}

const OPENAI_EFFORT_MAP: Record<ReasoningLevel, 'low' | 'medium' | 'high'> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'high',
  max: 'high'
};

const ANTHROPIC_BUDGET_TOKENS: Record<ReasoningLevel, number> = {
  low: 2048,
  medium: 4096,
  high: 8192,
  xhigh: 16384,
  max: 32768
};

const GOOGLE_BUDGET_TOKENS: Record<ReasoningLevel, number> = {
  low: 1024,
  medium: 4096,
  high: 16384,
  xhigh: 32768,
  max: 65536
};

/** 已知不支持 reasoning_effort 的 OpenAI 兼容模型（自带推理预算）。 */
const NO_EFFORT_MODEL_PATTERNS = [/deepseek-reasoner/i];
/** Gemini 2.0 与 Flash-Lite 等不支持 thinkingConfig。 */
const NO_GOOGLE_THINKING_PATTERNS = [/gemini-2\.0/i, /flash-lite/i];

function normalizeEffort(value: unknown): EffortKey {
  return typeof value === 'string' && ['none', 'low', 'medium', 'high', 'xhigh', 'max'].includes(value)
    ? value as EffortKey
    : 'high';
}

export function resolveThinkingConfig(effort: unknown, responseFormat: ResponseFormat, model: unknown): ThinkingConfig {
  const level = normalizeEffort(effort);
  if (level === 'none') return { enabled: false };
  if (responseFormat === 'anthropic') {
    return { enabled: true, budgetTokens: ANTHROPIC_BUDGET_TOKENS[level] };
  }
  if (responseFormat === 'google') {
    if (NO_GOOGLE_THINKING_PATTERNS.some((pattern) => pattern.test(String(model || '')))) {
      return { enabled: false };
    }
    return { enabled: true, budgetTokens: GOOGLE_BUDGET_TOKENS[level] };
  }
  if (NO_EFFORT_MODEL_PATTERNS.some((pattern) => pattern.test(String(model || '')))) {
    return { enabled: false };
  }
  return { enabled: true, reasoningEffort: OPENAI_EFFORT_MAP[level] };
}
