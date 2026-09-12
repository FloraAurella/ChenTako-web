// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  normalizeRegistryProvider,
  validateProviderModelConfiguration,
  deriveKeyEnv,
  urlsMatch,
  resolveProviderModelConfig,
  matchRegistryProvider,
  publicView,
  validateApiKey,
  ProviderError
} from '../../server/modules/providers/domain/registry-rules.ts';

describe('供应商注册表规则', () => {
  it('normalizeRegistryProvider：默认值、协议回退、模型列表兜底', () => {
    const provider = normalizeRegistryProvider({ displayName: ' A ', baseUrl: 'https://x.com///' })!;
    expect(provider.displayName).toBe(' A '); // displayName 原样保留（匹配靠调用方 trim）
    expect(provider.baseUrl).toBe('https://x.com');
    expect(provider.responseFormat).toBe('openai-compatible');
    expect(provider.enabled).toBe(true);
    expect(provider.maxTokens).toBe(8192);
    expect(provider.contextWindow).toBe(131072);
    const fromModel = normalizeRegistryProvider({ defaultModel: 'm1' })!;
    expect(fromModel.models).toEqual(['m1']);
    expect(fromModel.defaultModel).toBe('m1');
    expect(normalizeRegistryProvider(null)).toBeNull();
    const badFormat = normalizeRegistryProvider({ responseFormat: 'alien', models: ['m'] })!;
    expect(badFormat.responseFormat).toBe('openai-compatible');
  });

  it('validateProviderModelConfiguration：范围与覆盖引用校验', () => {
    expect(() => validateProviderModelConfiguration({ temperature: 3 })).toThrow(ProviderError);
    expect(() => validateProviderModelConfiguration({ contextWindow: 1.5 })).toThrow('上下文窗口');
    expect(() => validateProviderModelConfiguration({ modelOverrides: { ghost: {} }, models: ['m1'] })).toThrow('不存在的模型');
    expect(() => validateProviderModelConfiguration({ temperature: 1, modelOverrides: { m1: { topP: 0.5 } }, models: ['m1'] })).not.toThrow();
  });

  it('deriveKeyEnv 与 urlsMatch', () => {
    expect(deriveKeyEnv('DeepSeek 官方!')).toBe('deepseek');
    expect(deriveKeyEnv('!!!')).toBe('provider');
    expect(urlsMatch('https://api.x.com/v1', 'https://api.x.com')).toBe(true);
    expect(urlsMatch('https://api.x.com/v1', 'https://api.x.com/v1/chat')).toBe(true);
    expect(urlsMatch('https://api.x.com/v1', 'https://api.x.com/v2')).toBe(false); // 兄弟路径不算同一供应商
    expect(urlsMatch('https://api.x.com', 'http://api.x.com')).toBe(false);
    expect(urlsMatch('https://api.x.com', 'https://api.y.com')).toBe(false);
    expect(urlsMatch('garbage', 'https://api.x.com')).toBe(false);
  });

  it('matchRegistryProvider：id 优先，其次 displayName + 宽松 URL', () => {
    const registry = [
      normalizeRegistryProvider({ id: 'a', displayName: '甲', baseUrl: 'https://a.com' })!,
      normalizeRegistryProvider({ id: 'b', displayName: '乙', baseUrl: 'https://b.com/v1' })!
    ];
    expect(matchRegistryProvider(registry, { id: 'b' })?.id).toBe('b');
    expect(matchRegistryProvider(registry, { displayName: '乙', baseUrl: 'https://b.com' })?.id).toBe('b');
    expect(matchRegistryProvider(registry, { displayName: '乙', baseUrl: 'https://c.com' })).toBeNull();
    expect(matchRegistryProvider(registry, { displayName: '乙' })).toBeNull();
    // responseFormat 不作为硬性条件
    expect(matchRegistryProvider(registry, { id: 'a', responseFormat: 'google' })?.id).toBe('a');
  });

  it('resolveProviderModelConfig 应用模型覆盖；publicView 隐藏 keyEnv', () => {
    const provider = normalizeRegistryProvider({
      models: ['m1', 'm2'], contextWindow: 1000, maxTokens: 100,
      modelOverrides: { m1: { contextWindow: 2000, temperature: 0.3 } }
    })!;
    const merged = resolveProviderModelConfig(provider, 'm1');
    expect(merged.contextWindow).toBe(2000);
    expect(merged.temperature).toBe(0.3);
    expect(merged.maxTokens).toBe(100);
    expect(resolveProviderModelConfig(provider, 'm2').contextWindow).toBe(1000);
    const view = publicView(provider, true);
    expect('keyEnv' in view).toBe(false);
    expect(view.hasKeyConfigured).toBe(true);
  });

  it('validateApiKey：非空、长度、换行', () => {
    expect(validateApiKey('')).toEqual({ ok: false, error: 'API Key 不能为空' });
    expect(validateApiKey('a\nb').ok).toBe(false);
    expect(validateApiKey('x'.repeat(513)).ok).toBe(false);
    expect(validateApiKey(' sk-abc ')).toEqual({ ok: true, value: 'sk-abc' });
  });
});
