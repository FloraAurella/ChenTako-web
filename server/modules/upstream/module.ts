import type { BackendContributions, BackendModule } from '../../contracts/contributions.ts';
import { buildUpstreamRequest, type MergedProvider, type UpstreamRequestArgs } from './domain/request-builder.ts';
import { normalizeUpstreamJson } from './domain/normalize.ts';
import { validateUpstreamUrl, isLoopbackBaseUrl } from './domain/ssrf.ts';
import { collectProviderStreamRound, createProviderStreamProjector, finishReasonOf, type StreamProjectorEvent } from './services/provider-stream.ts';
import type { UpstreamSseFrame } from './services/sse.ts';
import { listModels, protocolHeaders } from './services/models.ts';

/**
 * upstream：四协议（responses / anthropic / openai-compatible / google）适配层。
 * 只负责「构造上游请求 → 解析上游响应」，不决定哪个供应商可用、不持有密钥。
 */
export interface UpstreamService {
  buildRequest(provider: MergedProvider, args: UpstreamRequestArgs): ReturnType<typeof buildUpstreamRequest>;
  normalizeJson(payload: unknown, responseFormat: Parameters<typeof normalizeUpstreamJson>[1]): ReturnType<typeof normalizeUpstreamJson>;
  /** 读取一整轮上游原生 SSE 并重建完整 payload；onRawFrame 供投影器消费。 */
  collect(body: ReadableStream<Uint8Array> | null | undefined, responseFormat: Parameters<typeof createProviderStreamProjector>[0], onRawFrame: (frame: UpstreamSseFrame) => void | Promise<void>): Promise<{ payload: Record<string, unknown> }>;
  /** 原生 payload 增量 → 稳定 chat.* 应用事件的投影器。 */
  project(responseFormat: Parameters<typeof createProviderStreamProjector>[0], emit: (event: StreamProjectorEvent) => void | Promise<void>, options?: { emitUsage?: boolean }): ReturnType<typeof createProviderStreamProjector>;
  finishReason(payload: Record<string, unknown>, responseFormat: Parameters<typeof finishReasonOf>[1]): string;
  validateUpstreamUrl(baseUrl: string, allowedHosts: readonly string[]): ReturnType<typeof validateUpstreamUrl>;
  isLoopbackBaseUrl(baseUrl: unknown): boolean;
  listModels(options: Parameters<typeof listModels>[0]): ReturnType<typeof listModels>;
  protocolHeaders(responseFormat: Parameters<typeof protocolHeaders>[0], apiKey: string): Record<string, string>;
}

export const createUpstreamModule = (validate = validateUpstreamUrl): BackendModule => ({
  id: 'upstream',
  dependsOn: [],
  setup({ services }) {
    const upstream: UpstreamService = {
      buildRequest: buildUpstreamRequest,
      normalizeJson: normalizeUpstreamJson,
      collect: collectProviderStreamRound,
      project: createProviderStreamProjector,
      finishReason: finishReasonOf,
      validateUpstreamUrl: validate,
      isLoopbackBaseUrl,
      listModels,
      protocolHeaders
    };
    services.services.register('upstream', { id: 'upstream', value: upstream });
    return () => services.services.removeOwner('upstream');
  }
});
export const module = createUpstreamModule();
