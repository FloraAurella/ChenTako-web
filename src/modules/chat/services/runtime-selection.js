import { snapshotProviderForModel } from '../../connections/public/domain_models.js';
import { resolveChatConfig } from '../../context/public/domain_config.js';
import { EFFORT_LEVELS } from '../../../contracts/constants.js';

/** Shared by the original runtime controls and slash commands. */
export function selectRuntimeModel(store, conversation, providerId, model) {
  const provider = store.state.providers.find(item => item.id === providerId);
  if (!provider || provider.enabled === false || !provider.models.includes(model)) {
    return { status: 'unavailable', message: '该模型已不可用，请重新选择。' };
  }
  conversation.providerId = provider.id;
  conversation.providerSnapshot = snapshotProviderForModel(provider, model);
  conversation.model = model;
  store.state.activeProviderId = provider.id;
  store.persistSoon();
  store.notify('conversation-updated');
  return { status: 'success', message: `模型已切换为 ${provider.displayName} / ${model}，下一次请求生效。` };
}
export function selectRuntimeEffort(store, conversation, value) {
  if (value !== null && !EFFORT_LEVELS.some(item => item.key === value)) return { status: 'error', message: '无效思考强度。' };
  const next = value ?? resolveChatConfig(store.state, { ...conversation, reasoningEffortOverride: null }).reasoningEffort;
  conversation.reasoningEffort = next;
  conversation.reasoningEffortOverride = value;
  store.state.preferredReasoningEffort = next;
  store.persistSoon();
  return { status: 'success', message: value === null ? '思考强度已恢复跟随配置，下一次请求生效。' : `思考强度已设为 ${next}，下一次请求生效。` };
}
