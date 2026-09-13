import type { CommandContext, CommandContribution, CommandResult } from '../../../contracts/commands';
import { writingService } from './work';
import type { WritingMode } from '../domain/work';

const ready = (ctx: CommandContext) => ctx.busy ? '当前对话正在处理请求，请先停止或等待完成。' : null;
function selectTarget(ctx: CommandContext) {
  if (!ctx.store) throw new Error('写作入口不可用。');
  const service = writingService(ctx.store);
  if (ctx.target) {
    const work = service.conversation(ctx.conversationId).writing;
    if (work?.error) throw new Error(work.error);
    const c = work?.chapters.find((c: any) => c.name === ctx.target);
    if (!c) throw new Error('没有找到该章节，请用 @ 选择已有章节。');
    service.select(ctx.conversationId, c.id);
  }
  return service;
}
function unquote(value: string) {
  if (!value.startsWith('"')) return value;
  try { const result = JSON.parse(value); if (typeof result === 'string') return result; } catch { /* report below */ }
  throw new Error('章名引号不完整，请使用双引号。');
}
function renameArguments(input: string): [string, string] {
  const match = input.trim().match(/^("(?:\\.|[^"\\])*"|[^\s"]+)\s+("(?:\\.|[^"\\])*"|[^\s"]+)$/u);
  if (!match) throw new Error('用法：/name 旧名字 新名字；含空格的章名请用双引号包住。');
  return [unquote(match[1]), unquote(match[2])];
}
const modeLabels = { chat: '讨论', write: '写作', edit: '编辑' };
export const writingCommands: CommandContribution[] = [
  { id: 'create', name: 'create', label: '创建章节', icon: 'newChat', description: '创建并选中空章节', parameters: '章名', acceptsMultiline: true, available: ready,
    execute(ctx, argument) {
      if (ctx.target || /^-if(?:\s|$)/i.test(argument)) return { status: 'error', message: '首版只支持线性章节，尚不支持分支创建。' };
      selectTarget(ctx).create(ctx.conversationId, unquote(argument.trim()));
      return { status: 'success', message: '章节已创建并选中。' };
    } },
  { id: 'name', name: 'name', label: '重命名章节', icon: 'edit', description: '修改已有章节名称，保留正文和版本', parameters: '旧名字 新名字', available: ready,
    execute(ctx, argument) {
      const [oldName, newName] = renameArguments(argument);
      if (!ctx.store) throw new Error('写作入口不可用。');
      const service = writingService(ctx.store);
      const work = service.conversation(ctx.conversationId).writing;
      if (work?.error) throw new Error(work.error);
      const chapter = work?.chapters.find((c: any) => c.name === oldName);
      if (!chapter) throw new Error('没有找到该章节，请检查旧名字。');
      service.rename(ctx.conversationId, chapter.id, newName);
      return { status: 'success', message: '章节已重命名。' };
    } },
  ...(['chat', 'write', 'edit'] as WritingMode[]).map((mode): CommandContribution => ({
    id: mode, name: mode, label: modeLabels[mode], icon: 'chat', description: `切换${modeLabels[mode]}模式，可附带要求`, parameters: '[要求]', executeOnSelect: true, acceptsMultiline: true, submitsContent: true, available: ready,
    async execute(ctx, argument): Promise<CommandResult> {
      const service = selectTarget(ctx); service.mode(ctx.conversationId, mode);
      if (argument.trim()) {
        const sent = await ctx.submitContent?.(argument.trim());
        return sent ? { status: 'success', message: '请求已提交。' } : { status: 'error', message: '请求未提交，输入已保留。请查看错误提示或章节面板。' };
      }
      return { status: 'success', message: `已进入${modeLabels[mode]}模式，后续输入沿用此模式。` };
    }
  })),
  { id: '@', name: '@', hidden: true, inputPrefix: '@', label: '选择章节', icon: 'archive', description: '选择当前作品章节', parameters: '章名', available: ready,
    options(ctx, query) {
      const work = ctx.store?.activeConversation()?.writing;
      return (work?.chapters || []).filter((c: any) => c.name.includes(query.replace(/^"|"$/g, ''))).map((c: any) => ({ id: c.id, label: c.name, detail: c.body ? '正文' : '空章', argument: JSON.stringify(c.name), selected: c.id === work.selectedId,
        choose: () => { writingService(ctx.store).select(ctx.conversationId, c.id); return { status: 'success', message: `已选中 ${c.name}。` }; } }));
    },
    execute(ctx, argument) {
      if (!argument) return { status: 'error', message: '请用 @章名 或 @"含空格的章名" 选择章节；后面可接 /write 或 /edit。' };
      const service = selectTarget({ ...ctx, target: argument });
      return { status: 'success', message: `已选中 ${service.work(ctx.conversationId).chapters.find(c => c.id === service.work(ctx.conversationId).selectedId)?.name}。` };
    }
  }
];
