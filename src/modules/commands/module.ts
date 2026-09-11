import type { FrontendModule } from '../../contracts/contributions';
export const module: FrontendModule = {
  id: 'commands',
  setup({ services, scope }) {
    scope.defer(services.commands.register('commands', {
      id: 'help', name: 'help', description: '查看指令帮助', parameters: '',
      available: () => null,
      execute: (_context, argument) => argument
        ? { status: 'error', message: '/help 不接受参数。' }
        : { status: 'help', lines: [
          ...services.commands.list().map(command => `/${command.name}${command.parameters ? ` ${command.parameters}` : ''} — ${command.description}`),
          '示例：/model 模型名；/effort high；/effort 跟随配置。模型重名时请选择供应商。',
          '模型与强度修改当前会话，并沿用按钮的最近选择记忆；不会修改项目或全局默认配置。',
          '正在回复或压缩时可以修改下一次请求的配置；已开始的请求保持原配置。发送按钮仍用于停止回复，请用 Enter 执行指令。',
          '/compact 会发起额外的模型请求，仅压缩已完成的历史，保留原聊天记录。',
          '整条单行输入才识别为指令。正文中的斜杠和多行内容原样发送。输入 //model 可发送字面量 /model。',
          '↑↓ 选择 · Tab 补全 · Enter 确认 · Esc 关闭 · Shift + Enter 换行。指令不会发送给模型，待发送附件会保留。'
        ] }
    }));
  }
};
