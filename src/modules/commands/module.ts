import type { FrontendModule } from '../../contracts/contributions';
export const module: FrontendModule = {
  id: 'commands',
  setup({ services, scope }) {
    scope.defer(services.commands.register('commands', {
      id: 'help', name: 'help', label: '帮助', icon: 'info', description: '查看指令帮助', parameters: '',
      available: () => null,
      execute: (_context, argument) => argument
        ? { status: 'error', message: '/help 不接受参数。' }
        : { status: 'help', lines: [
          ...services.commands.list().map(command => `${command.inputPrefix || "/" + command.name}${command.parameters ? ` ${command.parameters}` : ''} — ${command.description}`),
          '示例：/model 模型名；/effort high；/effort 跟随配置。模型重名时请选择供应商。',
          '模型与强度修改当前会话，并沿用按钮的最近选择记忆；不会修改项目或全局默认配置。',
          '正在回复或压缩时可以修改下一次请求的配置；已开始的请求保持原配置。发送按钮仍用于停止回复，请用 Enter 执行指令。',
          '/compact 会发起额外的模型请求，仅压缩已完成的历史，保留原聊天记录。',
          '配置指令仍为单行；支持正文的写作指令可带多行要求。@章名 选择章节；@@ 可发送字面量 @。正文中的符号原样保留。输入 //model 可发送字面量 /model。',
          '↑↓ 选择 · Tab 补全 · Enter 确认 · Esc 关闭 · Shift + Enter 换行。指令不会发送给模型，待发送附件会保留。'
        ] }
    }));
  }
};
