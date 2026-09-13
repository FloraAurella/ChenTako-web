import { resolveEffectiveModelConfig } from '../../connections/public/domain_models.js';
import { estimateContextTokens, resolveInputBudget } from '../../context/public/domain_budget.js';

/** Capture both the provider identity and effective limits, without credentials. */
export function captureAuxiliaryModel(state, selection, currentProvider, currentModel) {
  const provider = selection ? state.providers.find(item => item.id === selection.providerId) : currentProvider;
  const model = selection?.model || currentModel;
  if (!provider || provider.enabled === false || !provider.models.includes(model)) return { error: '专用模型已不可用，请在上下文策略中重新选择。' };
  const { contextWindow, maxTokens } = resolveEffectiveModelConfig(provider, model);
  return structuredClone({ model, limits: { contextWindow, maxTokens },
    header: { id: provider.id, displayName: provider.displayName, baseUrl: provider.baseUrl, responseFormat: provider.responseFormat } });
}

export function validateAuxiliaryInput(target, input) {
  if (target.error) throw new Error(target.error);
  if (estimateContextTokens(input) > resolveInputBudget(target.limits, {})) throw new Error('专用模型的上下文窗口不足，请选择更大窗口的模型。');
}
