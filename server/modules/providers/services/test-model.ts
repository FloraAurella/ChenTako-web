import { HttpError } from '../../../core/router.ts';
import type { UpstreamService } from '../../upstream/public/module.ts';

/** A bounded, isolated response probe; never includes chat history or project data. */
export async function testModel(upstream: UpstreamService, options: {
  baseUrl: string; responseFormat: Parameters<UpstreamService['listModels']>[0]['responseFormat'];
  apiKey: string; model: string; signal: AbortSignal;
}) {
  const { baseUrl, responseFormat, apiKey, model, signal } = options;
  const startedAt = Date.now();
  const built = upstream.buildRequest({
    id: '', displayName: '', keyEnv: '', enabled: true, baseUrl, responseFormat, apiKey,
    defaultModel: model, models: [model], modelCapabilities: {}, modelOverrides: {},
    defaultReasoningEffort: '', maxTokens: 1024, contextWindow: 8192,
    temperature: 1, topP: 1, streaming: false, saveChats: false, systemPrompt: '', userId: ''
  }, { model, reasoningEffort: 'none', stream: false, messages: [{ role: 'user', content: 'Reply with OK.' }] });
  const response = await fetch(built.url, { ...built.options, signal, redirect: 'error' });
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(`模型响应失败（HTTP ${response.status}），请检查模型 ID、权限和 API 格式`, response.status);
  }
  const payload = await response.json().catch(() => { throw new HttpError('模型返回的不是有效 JSON', 502); });
  const normalized = upstream.normalizeJson(payload, responseFormat);
  if (!normalized.content.trim()) throw new HttpError('模型未返回文字回复，请检查模型是否支持文字聊天', 502);
  return { ok: true, model, reply: normalized.content.slice(0, 160), latencyMs: Date.now() - startedAt };
}
