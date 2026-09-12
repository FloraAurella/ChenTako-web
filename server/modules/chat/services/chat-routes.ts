import { APP_STREAM_EVENTS, type NormalizedResponse } from '../../../contracts/protocol.ts';
import { STREAM_TIMEOUT_MS } from '../../../contracts/limits.ts';
import type { ChatConfig, ProviderHeader, WireMessage } from '../../../contracts/types.ts';
import { HttpError, SseWriter, sendJson, readJsonBody, type RequestContext } from '../../../core/router.ts';
import type { ProviderStore } from '../../providers/public/services_store.ts';
import { resolveProviderModelConfig } from '../../providers/public/domain_registry-rules.ts';
import type { UpstreamService } from '../../upstream/public/module.ts';
import { ContextBudgetError, type MergedProvider } from '../../upstream/public/domain_request-builder.ts';
import { parseChatConfig } from '../domain/chat-config.ts';
import { validateMessages, validateContextSummary, hasExecutableExtensions, EXTENSIONS_UNSUPPORTED_ERROR, CONTEXT_COMPRESSION_PROMPT } from '../domain/validation.ts';

/** chat 路由共享的依赖句柄。 */
export interface ChatDeps {
  store: ProviderStore;
  upstream: UpstreamService;
  ssrfAllow: readonly string[];
  bodyLimit: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError');
}

interface ResolvedRequest {
  chatConfig: ChatConfig | null;
  reasoningEffort: unknown;
  model: string;
  messages: WireMessage[];
  contextSummary: string;
  wantsStream: boolean;
  merged: MergedProvider;
}

/** 解析 chatConfig 之后的共同校验路径；供应商匹配/SSRF/Key 检查在这里统一收口。 */
async function resolveChatRequest(deps: ChatDeps, req: RequestContext['req'], body: Record<string, unknown>, chatConfig: ChatConfig | null): Promise<ResolvedRequest> {
  const header = body.provider as ProviderHeader | undefined;
  if (!header || typeof header !== 'object' || Array.isArray(header)) throw new HttpError('缺少 provider 配置', 400);
  const model = body.model;
  if (!model || typeof model !== 'string' || !model.trim()) throw new HttpError('缺少 model', 400);
  if (!Array.isArray(body.messages) || !body.messages.length) throw new HttpError('缺少 messages', 400);
  const messageError = validateMessages(body.messages as WireMessage[]);
  if (messageError) throw new HttpError(messageError, 400);
  const summaryCheck = validateContextSummary(body.contextSummary);
  if (!summaryCheck.ok) throw new HttpError(summaryCheck.error!, 400);

  const registered = deps.store.match({
    id: String(header.id || ''),
    displayName: String(header.displayName || ''),
    baseUrl: String(header.baseUrl || ''),
    responseFormat: String(header.responseFormat || '')
  });
  if (!registered) {
    throw new HttpError(`后端未注册供应商「${String(header.displayName || '未命名')}」（${String(header.baseUrl || '无地址')}）。请先在设置中保存供应商配置。`, 404);
  }
  if (registered.enabled === false) throw new HttpError('供应商已禁用', 409, 'PROVIDER_DISABLED');
  const ssrfCheck = await deps.upstream.validateUpstreamUrl(registered.baseUrl, deps.ssrfAllow);
  if (!ssrfCheck.ok) throw new HttpError(`上游地址被拒绝：${ssrfCheck.reason}`, 400);
  const apiKey = deps.store.resolveKey(registered);
  if (!apiKey && !deps.upstream.isLoopbackBaseUrl(registered.baseUrl)) {
    throw new HttpError(`供应商「${registered.displayName}」未配置 API Key。请在设置界面保存，或在环境中设置 CLAWBOX_API_KEY_${registered.keyEnv}。`, 401);
  }

  const modelConfig = resolveProviderModelConfig(registered, model.trim());
  const merged: MergedProvider = {
    ...modelConfig,
    apiKey,
    ...(chatConfig ? {
      systemPrompt: chatConfig.systemPrompt,
      temperature: chatConfig.temperature,
      topP: chatConfig.topP,
      userId: chatConfig.userId,
      inputBudget: chatConfig.inputBudget,
      chatConfigVersion: 1
    } : {})
  };
  return {
    chatConfig,
    reasoningEffort: chatConfig?.reasoningEffort ?? body.reasoningEffort,
    model: model.trim(),
    messages: body.messages as WireMessage[],
    contextSummary: summaryCheck.value ?? '',
    wantsStream: chatConfig ? chatConfig.streaming : body.stream !== false,
    merged
  };
}

/** 与原版一致的请求生命周期：5 分钟超时 + 客户端断连中止上游。 */
function bindLifecycle(res: RequestContext['res']): { controller: AbortController; done: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('上游请求超时')), STREAM_TIMEOUT_MS);
  const onClientClose = () => controller.abort();
  res.on('close', onClientClose);
  return {
    controller,
    done: () => {
      clearTimeout(timeout);
      res.removeListener('close', onClientClose);
    }
  };
}

async function readUpstreamError(response: Response): Promise<string> {
  const bodyText = await response.text().catch(() => '');
  let detail = bodyText;
  try {
    const parsed = JSON.parse(bodyText);
    detail = parsed?.error?.message || parsed?.message || bodyText;
  } catch { /* 保留原文 */ }
  return String(detail).slice(0, 500);
}

/** POST /api/chat：流式走 SSE v1 应用协议，非流式返回归一化 JSON。 */
export async function handleChat(deps: ChatDeps, { req, res }: RequestContext): Promise<void> {
  const body = await readJsonBody(req, deps.bodyLimit);
  let chatConfig: ChatConfig | null;
  try { chatConfig = parseChatConfig(body.chatConfig); }
  catch (error) { throw new HttpError(errorMessage(error), 400); }
  if (hasExecutableExtensions(body.extensions)) {
    throw new HttpError(EXTENSIONS_UNSUPPORTED_ERROR, 400, 'EXTENSIONS_UNSUPPORTED');
  }
  const request = await resolveChatRequest(deps, req, body, chatConfig);
  const { controller, done } = bindLifecycle(res);

  try {
    const built = deps.upstream.buildRequest(request.merged, {
      model: request.model,
      reasoningEffort: request.reasoningEffort,
      stream: request.wantsStream,
      messages: request.messages,
      contextSummary: request.contextSummary
    });
    let upstream: Response;
    try {
      upstream = await fetch(built.url, { ...built.options, signal: controller.signal });
    } catch (error) {
      const aborted = controller.signal.aborted || isAbortError(error);
      throw new HttpError(aborted ? '上游请求超时或连接已断开' : `无法连接上游服务：${errorMessage(error)}`, aborted ? 504 : 502);
    }
    if (!upstream.ok) {
      throw new HttpError(`上游返回 ${upstream.status}：${await readUpstreamError(upstream)}`,
        upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502);
    }

    if (!request.wantsStream) {
      let payload: unknown;
      try { payload = await upstream.json(); }
      catch (error) {
        if (controller.signal.aborted || isAbortError(error)) throw new HttpError('上游请求超时或连接已断开', 504);
        throw new HttpError('上游返回了无法解析的 JSON', 502);
      }
      const normalized: NormalizedResponse = deps.upstream.normalizeJson(payload, request.merged.responseFormat);
      sendJson(res, 200, { ...normalized, skippedAttachments: built.skippedFiles });
      return;
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/event-stream')) {
      const bodyText = await upstream.text().catch(() => '');
      throw new HttpError(`上游未返回 SSE 流${bodyText ? `：${bodyText.slice(0, 300)}` : ''}`, 502);
    }

    const writer = new SseWriter(res);
    await writer.event(APP_STREAM_EVENTS.started, {
      version: 1,
      providerId: request.merged.id,
      reasoningKind: request.merged.responseFormat === 'responses' ? 'summary' : 'thinking'
    });
    if (built.skippedFiles.length) {
      await writer.event(APP_STREAM_EVENTS.attachmentsSkipped, { items: built.skippedFiles });
    }
    const projector = deps.upstream.project(request.merged.responseFormat, (event) => writer.event(event.event, event.data));
    const { payload } = await deps.upstream.collect(upstream.body, request.merged.responseFormat, (frame) => projector.consume(frame));
    await projector.emitFinal(payload);
    await writer.event(APP_STREAM_EVENTS.completed, { finishReason: projector.finishReason(payload) });
    writer.end();
  } catch (error) {
    const aborted = controller.signal.aborted || isAbortError(error);
    if (res.headersSent) {
      // SSE 已开始：错误经应用层协议收尾，前端按 chat.stream.error 呈现
      if (!res.writableEnded && !res.destroyed) {
        const writer = new SseWriter(res);
        await writer.event(APP_STREAM_EVENTS.error, {
          message: aborted ? '流式请求已取消或超时' : (errorMessage(error) || '流式传输中断')
        });
        writer.end();
      }
      return;
    }
    if (error instanceof HttpError) throw error;
    if (error instanceof ContextBudgetError) throw new HttpError(error.message, 400, error.code);
    throw new HttpError(aborted ? '上游请求超时或连接已断开' : `无法连接上游服务：${errorMessage(error)}`, aborted ? 504 : 502);
  } finally {
    done();
  }
}

/** POST /api/chat/compress：固定内置技术指令生成摘要；只服从压缩目标，不带人格提示词。 */
export async function handleCompress(deps: ChatDeps, { req, res }: RequestContext): Promise<void> {
  const body = await readJsonBody(req, deps.bodyLimit);
  const request = await resolveChatRequest(deps, req, body, null);
  const { controller, done } = bindLifecycle(res);

  try {
    const merged: MergedProvider = {
      ...request.merged,
      temperature: 0.7, topP: 1, userId: '',
      systemPrompt: CONTEXT_COMPRESSION_PROMPT
    };
    const built = deps.upstream.buildRequest(merged, {
      model: request.model,
      reasoningEffort: 'high',
      stream: false,
      messages: request.messages,
      contextSummary: request.contextSummary
    });
    let upstream: Response;
    try {
      upstream = await fetch(built.url, { ...built.options, signal: controller.signal });
    } catch (error) {
      const aborted = controller.signal.aborted || isAbortError(error);
      throw new HttpError(aborted ? '上下文压缩超时或连接已断开' : `无法连接压缩模型：${errorMessage(error)}`, aborted ? 504 : 502);
    }
    if (!upstream.ok) {
      throw new HttpError(`上下文压缩失败（${upstream.status}）：${await readUpstreamError(upstream)}`,
        upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502);
    }
    let payload: unknown;
    try { payload = await upstream.json(); }
    catch {
      throw new HttpError('压缩模型返回了无法解析的 JSON', 502);
    }
    const normalized = deps.upstream.normalizeJson(payload, request.merged.responseFormat);
    const summary = String(normalized.content || normalized.reasoning || '').trim();
    if (!summary) throw new HttpError('压缩模型没有返回有效摘要', 502);
    if (Buffer.byteLength(summary, 'utf8') > 2 * 1024 * 1024) {
      throw new HttpError('压缩结果超过 2MB，请缩短对话后重试', 502);
    }
    sendJson(res, 200, { ok: true, summary, usage: normalized.usage });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const aborted = controller.signal.aborted || isAbortError(error);
    throw new HttpError(aborted ? '上下文压缩超时或连接已断开' : `无法连接压缩模型：${errorMessage(error)}`, aborted ? 504 : 502);
  } finally {
    done();
  }
}
