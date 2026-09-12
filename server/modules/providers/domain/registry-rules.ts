import { randomUUID } from 'node:crypto';
import { DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS, RESPONSE_FORMATS, type ResponseFormat } from '../../../contracts/limits.ts';
import type { ModelCapability, ModelOverride, ProviderHeader, ProviderRecord, PublicProvider } from '../../../contracts/types.ts';

/**
 * 供应商注册表纯规则（原版 lib/providers.ts 移植）：规范化、校验、匹配。
 * Key 相关一律不在本层出现。
 */
export type ProviderInput = Record<string, unknown>;

export class ProviderError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
  }
}

const VALID_EFFORTS = new Set(['', 'low', 'medium', 'high', 'xhigh', 'max']);

function normalizeMaxTokens(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_MAX_TOKENS;
  return Math.min(1000000, Math.floor(number));
}

function normalizeContextWindow(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_CONTEXT_WINDOW;
  return Math.min(10000000, Math.floor(number));
}

function normalizeModelCapabilities(value: unknown, models: string[]): Record<string, ModelCapability> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const normalizeFlag = (flag: unknown): ModelCapability['visionInput'] => (flag === true ? true : flag === false ? false : 'auto');
  return Object.fromEntries(models.map((model) => {
    const entry = source[model] && typeof source[model] === 'object' ? source[model] as Record<string, unknown> : {};
    return [model, { visionInput: normalizeFlag(entry.visionInput), imageOutput: normalizeFlag(entry.imageOutput) }];
  }));
}

function normalizeModelOverrides(value: unknown, models: string[]): Record<string, ModelOverride> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result: Record<string, ModelOverride> = {};
  for (const model of models) {
    const entry = source[model];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const override = entry as Record<string, unknown>;
    const normalized: ModelOverride = {};
    const contextWindow = Number(override.contextWindow);
    const maxTokens = Number(override.maxTokens);
    const temperature = Number(override.temperature);
    const topP = Number(override.topP);
    const effort = String(override.defaultReasoningEffort ?? '');
    if (Number.isFinite(contextWindow) && contextWindow > 0) normalized.contextWindow = normalizeContextWindow(contextWindow);
    if (Number.isFinite(maxTokens) && maxTokens > 0) normalized.maxTokens = normalizeMaxTokens(maxTokens);
    if (Number.isFinite(temperature) && temperature >= 0 && temperature <= 2) normalized.temperature = temperature;
    if (Number.isFinite(topP) && topP >= 0 && topP <= 1) normalized.topP = topP;
    if (Object.hasOwn(override, 'defaultReasoningEffort') && VALID_EFFORTS.has(effort)) {
      normalized.defaultReasoningEffort = effort as ModelOverride['defaultReasoningEffort'];
    }
    if (Object.keys(normalized).length) result[model] = normalized;
  }
  return result;
}

export function normalizeRegistryProvider(provider: ProviderInput | null | undefined): ProviderRecord | null {
  if (!provider || typeof provider !== 'object') return null;
  const rawModels = Array.isArray(provider.models) ? provider.models : [];
  const models = rawModels
    .map((value) => String(value).trim())
    .filter(Boolean);
  if (!models.length) {
    const fallbackModel = String(provider.defaultModel || provider.model || '').trim();
    if (fallbackModel) models.push(fallbackModel);
  }
  return {
    id: String(provider.id || ''),
    displayName: String(provider.displayName || '未命名供应商'),
    enabled: provider.enabled !== false,
    keyEnv: String(provider.keyEnv || ''),
    baseUrl: String(provider.baseUrl || '').replace(/\/+$/, ''),
    responseFormat: (RESPONSE_FORMATS as readonly string[]).includes(String(provider.responseFormat))
      ? provider.responseFormat as ResponseFormat
      : 'openai-compatible',
    defaultReasoningEffort: (VALID_EFFORTS.has(String(provider.defaultReasoningEffort || ''))
      ? String(provider.defaultReasoningEffort)
      : '') as ProviderRecord['defaultReasoningEffort'],
    defaultModel: String(provider.defaultModel || provider.model || models[0] || ''),
    models,
    modelCapabilities: normalizeModelCapabilities(provider.modelCapabilities, models),
    modelOverrides: normalizeModelOverrides(provider.modelOverrides, models),
    maxTokens: normalizeMaxTokens(provider.maxTokens),
    contextWindow: normalizeContextWindow(provider.contextWindow),
    temperature: Number.isFinite(Number(provider.temperature)) ? Number(provider.temperature) : 0.7,
    topP: Number.isFinite(Number(provider.topP)) ? Math.min(1, Math.max(0, Number(provider.topP))) : 1,
    streaming: provider.streaming !== false,
    saveChats: provider.saveChats !== false,
    systemPrompt: String(provider.systemPrompt || ''),
    userId: String(provider.userId || '')
  };
}

function validateNumberField(
  provider: ProviderInput,
  key: string,
  label: string,
  minimum: number,
  maximum: number,
  integer = false
): void {
  if (!Object.hasOwn(provider, key)) return;
  const number = Number(provider[key]);
  if (!Number.isFinite(number) || number < minimum || number > maximum || (integer && !Number.isInteger(number))) {
    throw new ProviderError(`${label}必须是 ${minimum}–${maximum}${integer ? ' 的整数' : ''}`, 'INVALID_PROVIDER');
  }
}

/** 递归校验数字字段；模型覆盖按同样规则逐项校验。 */
export function validateProviderModelConfiguration(provider: ProviderInput): void {
  validateNumberField(provider, 'contextWindow', '上下文窗口', 1, 10000000, true);
  validateNumberField(provider, 'maxTokens', '最大输出 Token', 1, 1000000, true);
  validateNumberField(provider, 'temperature', 'Temperature', 0, 2);
  validateNumberField(provider, 'topP', 'Top P', 0, 1);
  if (Object.hasOwn(provider, 'defaultReasoningEffort') && !VALID_EFFORTS.has(String(provider.defaultReasoningEffort ?? ''))) {
    throw new ProviderError('默认思考强度无效', 'INVALID_PROVIDER');
  }
  if (provider.modelOverrides === undefined) return;
  if (!provider.modelOverrides || typeof provider.modelOverrides !== 'object' || Array.isArray(provider.modelOverrides)) {
    throw new ProviderError('模型覆盖配置必须是对象', 'INVALID_PROVIDER');
  }
  const models = new Set(
    (Array.isArray(provider.models) ? provider.models as unknown[] : [])
      .map((model) => String(model).trim()).filter(Boolean)
  );
  for (const [modelId, overrideValue] of Object.entries(provider.modelOverrides as Record<string, unknown>)) {
    if (!models.has(modelId)) {
      throw new ProviderError(`模型覆盖引用了不存在的模型「${modelId}」`, 'INVALID_PROVIDER');
    }
    if (!overrideValue || typeof overrideValue !== 'object' || Array.isArray(overrideValue)) {
      throw new ProviderError(`模型「${modelId}」的覆盖配置无效`, 'INVALID_PROVIDER');
    }
    validateProviderModelConfiguration(overrideValue as ProviderInput);
  }
}

/** 由显示名派生稳定 keyEnv（Key 的存储键名）。 */
export function deriveKeyEnv(displayName: unknown): string {
  const slug = String(displayName || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug || 'provider';
}

/** 宽松 baseUrl 匹配：协议+主机+端口一致，路径互为前缀即同一供应商。 */
export function urlsMatch(a: unknown, b: unknown): boolean {
  try {
    const urlA = new URL(String(a));
    const urlB = new URL(String(b));
    if (urlA.protocol !== urlB.protocol || urlA.hostname !== urlB.hostname || urlA.port !== urlB.port) return false;
    const pathA = urlA.pathname === '/' ? '' : urlA.pathname.replace(/\/+$/, '');
    const pathB = urlB.pathname === '/' ? '' : urlB.pathname.replace(/\/+$/, '');
    return !pathA || !pathB || pathA === pathB ||
      pathA.startsWith(`${pathB}/`) || pathB.startsWith(`${pathA}/`);
  } catch {
    return false;
  }
}

export function resolveProviderModelConfig(provider: ProviderRecord, modelId: unknown): ProviderRecord {
  const override = provider.modelOverrides[String(modelId || '')] || {};
  return {
    ...provider,
    contextWindow: override.contextWindow ?? provider.contextWindow,
    maxTokens: override.maxTokens ?? provider.maxTokens,
    temperature: override.temperature ?? provider.temperature,
    topP: override.topP ?? provider.topP,
    defaultReasoningEffort: override.defaultReasoningEffort ?? provider.defaultReasoningEffort
  };
}

/**
 * 前端携带「本地供应商信息」时在注册表里匹配对应条目：
 * 优先 id 精确匹配，其次 displayName + 宽松 URL 匹配；responseFormat 不作硬性条件。
 */
export function matchRegistryProvider(registry: readonly ProviderRecord[], header: ProviderHeader): ProviderRecord | null {
  const url = String(header.baseUrl || '').trim().replace(/\/+$/, '');
  if (header.id) {
    const byId = registry.find((item) => item.id === String(header.id));
    if (byId) return byId;
  }
  const name = String(header.displayName || '').trim();
  if (!name || !url) return null;
  return registry.find((provider) => provider.displayName === name && urlsMatch(provider.baseUrl, url)) || null;
}

/** 对外只暴露不含 keyEnv 的视图；hasKeyConfigured 由存储层判定后传入。 */
export function publicView(provider: ProviderRecord, hasKey: boolean): PublicProvider {
  const { keyEnv: _keyEnv, ...rest } = provider;
  return { ...rest, hasKeyConfigured: hasKey };
}

export function newProviderId(): string {
  return randomUUID();
}

/** API Key 形态校验（原版 chat.ts validateApiKey 移植）：非空、≤512、无换行。 */
export function validateApiKey(value: unknown): { ok: boolean; error?: string; value?: string } {
  const key = String(value || '').trim();
  if (!key) return { ok: false, error: 'API Key 不能为空' };
  if (key.length > 512) return { ok: false, error: 'API Key 过长（最多 512 字符）' };
  if (/[\r\n]/.test(key)) return { ok: false, error: 'API Key 不能包含换行' };
  return { ok: true, value: key };
}

export { normalizeMaxTokens, normalizeContextWindow };
