import type { ResponseFormat } from '../../../contracts/limits.ts';
import { CONNECTION_TEST_TIMEOUT_MS } from '../../../contracts/limits.ts';

type JsonRecord = Record<string, unknown>;

/** 供应商连接测试共用的模型列表端点（原版 chat.ts extractModelIds/buildModelsUrl 移植）。 */
export function buildModelsUrl(baseUrl: unknown): string {
  return `${String(baseUrl || '').replace(/\/+$/, '')}/models`;
}

export function extractModelIds(payload: JsonRecord): string[] {
  const source: unknown[] = Array.isArray(payload?.data)
    ? payload.data as unknown[]
    : Array.isArray(payload?.models)
      ? payload.models as unknown[]
      : [];
  return [...new Set(source
    .map((item) => {
      if (item && typeof item === 'object') {
        const record = item as JsonRecord;
        return String(record.id || record.name || '').trim();
      }
      return String(item || '').trim();
    })
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

export function protocolHeaders(responseFormat: ResponseFormat, apiKey: string): Record<string, string> {
  if (responseFormat === 'anthropic') {
    return { ...(apiKey ? { 'x-api-key': apiKey } : {}), 'anthropic-version': '2023-06-01' };
  }
  if (responseFormat === 'google') {
    return apiKey ? { 'x-goog-api-key': apiKey } : {};
  }
  return apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
}

/** GET {base}/models 读取上游模型列表；不保存任何配置或 Key。 */
export async function listModels({
  baseUrl,
  responseFormat,
  apiKey,
  signal
}: {
  baseUrl: string;
  responseFormat: ResponseFormat;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<{ models: string[]; latencyMs: number }> {
  const startedAt = Date.now();
  const upstream = await fetch(buildModelsUrl(baseUrl), {
    method: 'GET',
    headers: protocolHeaders(responseFormat, apiKey),
    signal
  });
  const text = await upstream.text();
  let payload: JsonRecord = {};
  try { payload = text ? JSON.parse(text) as JsonRecord : {}; } catch { /* 使用空对象 */ }
  if (!upstream.ok) {
    const detail = (payload?.error as JsonRecord | undefined)?.message || payload?.message || text || `HTTP ${upstream.status}`;
    throw Object.assign(new Error(`连接上游失败（${upstream.status}）：${String(detail).slice(0, 300)}`), { upstreamStatus: upstream.status });
  }
  return { models: extractModelIds(payload), latencyMs: Date.now() - startedAt };
}

export { CONNECTION_TEST_TIMEOUT_MS };
