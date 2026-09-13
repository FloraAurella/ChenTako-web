import type { CommandContext, CommandContribution, CommandOption } from '../../../contracts/commands';
import { EFFORT_LEVELS } from '../../../contracts/constants.js';

function modelOptions(context: CommandContext, query: string): CommandOption[] {
  const exact = context.models.filter(item => item.model === query);
  const candidates = exact.length ? exact : context.models.filter(item => `${item.providerName} ${item.model}`.toLowerCase().includes(query.toLowerCase()));
  return candidates.map(item => ({
    id: JSON.stringify([item.providerId, item.model]), label: item.model, detail: item.providerName, argument: item.model,
    selected: item.selected, choose: () => context.selectModel(item.providerId, item.model)
  }));
}
function effortValue(argument: string): string | null | undefined {
  if (['default', '跟随配置'].includes(argument.toLowerCase())) return null;
  return EFFORT_LEVELS.find(item => item.key === argument.toLowerCase() || item.label === argument)?.key;
}
function effortOptions(context: CommandContext, query: string): CommandOption[] {
  return [
    ...EFFORT_LEVELS.map(item => ({ id: item.key, label: item.label, detail: item.key, argument: item.key,
      selected: !context.followsConfig && context.effort === item.key, choose: () => context.selectEffort(item.key) })),
    { id: 'default', argument: 'default', label: '跟随配置', detail: `default · 当前继承 ${context.effort}`, selected: context.followsConfig, choose: () => context.selectEffort(null) }
  ].filter(item => `${item.label} ${item.detail}`.toLowerCase().includes(query.toLowerCase()));
}
export const chatCommands: CommandContribution[] = [
  { id: 'model', name: 'model', label: '模型', icon: 'connection', description: '切换当前会话模型', parameters: '[模型名]', summary: context => context.models.find(item => item.selected)?.model || '未选择', available: context => context.mutationUnavailable || null,
    options: modelOptions,
    execute(context, argument) {
      const exact = context.models.filter(item => item.model === argument);
      if (argument && exact.length === 1) return context.selectModel(exact[0].providerId, exact[0].model);
      const options = modelOptions(context, argument);
      return { status: 'select', title: '选择模型', options,
        message: !context.models.length ? '没有可用模型，请在设置中配置并启用供应商。' : !options.length ? '没有匹配的模型，请修改搜索文字。' : exact.length > 1 ? '模型名称重复，请选择供应商。' : undefined };
    }
  },
  { id: 'effort', name: 'effort', label: '思考强度', icon: 'spark', description: '调整思考强度或恢复跟随配置', parameters: '[强度 / default]', summary: context => `${context.effort} · ${context.followsConfig ? '跟随配置' : '会话自定义'}`, available: context => context.mutationUnavailable || null,
    options: effortOptions,
    execute(context, argument) {
      if (!argument) return { status: 'select', title: '选择思考强度', options: effortOptions(context, '') };
      const value = effortValue(argument);
      return value === undefined ? { status: 'error', message: '无效强度。可用值：low、medium、high、xhigh、max、default，或对应中文名称。' } : context.selectEffort(value);
    }
  },
  { id: 'compact', name: 'compact', label: '压缩历史', icon: 'archive', description: '压缩已完成的聊天历史', parameters: '',
    available: context => context.compactUnavailable,
    execute: (context, argument) => argument ? { status: 'error', message: '/compact 不接受参数。' } : context.compact()
  }
];
