import { LIMITS } from '../../../contracts/constants.js';
import { apiFetch } from '../../../shared/api.js';
import { normalizeProviderResponse } from '../../connections/public/domain_adapters.js';
import { resolveEffectiveModelConfig } from '../../connections/public/domain_models.js';
import { estimateContextTokens, resolveInputBudget } from '../../context/public/domain_budget.js';

/** A bounded, cancellable auxiliary completion using the exact main-request snapshot. */
export async function completeRequestCheck(request, messages, suffix, signal) {
  const systemPrompt = request.config.systemPrompt + suffix;
  if (systemPrompt.length > LIMITS.requestSystemPromptChars) throw new Error('固定上下文超过请求传输上限，内容未截断。');
  const budget = resolveInputBudget(resolveEffectiveModelConfig(request.provider, request.model), request.config);
  if (estimateContextTokens({ systemPrompt, contextSummary: request.contextSummary, messages, extensions: request.extensions }) > budget) throw new Error('连贯性检查上下文超过预算，请选择更大窗口的模型；资料不会截断。');
  const response = await apiFetch('/api/chat', { method: 'POST', signal, body: JSON.stringify({
    provider: request.header, model: request.model, reasoningEffort: request.config.reasoningEffort,
    chatConfig: { ...request.config, systemPrompt, streaming: false, inputBudget: null, version: 1 }, stream: false,
    contextSummary: request.contextSummary, extensions: request.extensions, messages
  }) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `检查失败（HTTP ${response.status}）`);
  if (payload.skippedAttachments?.length) throw new Error('连贯性检查无法完整携带附件，请移除不支持的附件或更换模型。');
  if (!['', 'stop', 'end_turn', 'stop_sequence', 'completed', 'STOP'].includes(payload.finishReason || '')) throw new Error('连贯性检查未完整结束，请重试。');
  const content = normalizeProviderResponse(payload, request.provider.responseFormat).content;
  if (!content.trim()) throw new Error('检查返回空内容，请重试。');
  return content;
}
