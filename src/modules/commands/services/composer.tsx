import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Scope } from '../../../core/scope';
import type { Registry } from '../../../core/registry';
import type { CommandContext, CommandContribution, CommandOption, CommandResult } from '../../../contracts/commands';
import { parseCommandInput } from '../domain/parser';
import { CommandPanel, type PanelView } from '../ui/CommandPanel';
import { StatusText } from '../../../shared/ui/primitives';
import { TrustedIcon } from '../../../shared/ui/Icon';

interface ComposerBridge {
  input: HTMLTextAreaElement;
  feedbackHost: HTMLElement;
  registry: Registry<CommandContribution>;
  context(): CommandContext | null;
  beforeOpen(): void;
}
/** Separate UI root: the legacy composer remains the owner of its textarea and draft. */
export function createComposerCommands({ input, feedbackHost, registry, context, beforeOpen }: ComposerBridge) {
  const scope = new Scope();
  const host = document.createElement('div');
  host.className = 'command-panel-host'; host.hidden = true; document.body.append(host);
  const feedback = document.createElement('div');
  feedback.className = 'command-feedback compress-notice'; feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite'); feedback.hidden = true;
  feedbackHost.append(feedback);
  const feedbackRoot = createRoot(feedback);
  const root = createRoot(host);
  let view: PanelView | null = null;
  let options: CommandOption[] = [];
  let suggestions: CommandContribution[] = [];
  let mode: 'suggestions' | 'options' | 'help' = 'suggestions';
  let owner = '';
  let lastContextId = context()?.conversationId || '';
  let selectionReady = false;
  let version = 0;
  let navigated = false;
  let feedbackTimer = 0;
  let composing = false;
  let disposed = false;

  const ordered = () => registry.list().sort((a, b) => (a.id === 'help' ? 1 : b.id === 'help' ? -1 : 0));
  function close(focus = false) {
    view = null; host.hidden = true; options = []; suggestions = [];
    input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    input.removeAttribute('aria-controls');
    if (focus && !scope.disposed) input.focus({ preventScroll: true });
  }
  function position() {
    if (!view) return;
    const rect = input.getBoundingClientRect();
    const anchor = input.closest('.composer-paper')?.getBoundingClientRect() || rect;
    const viewport = window.visualViewport;
    const leftEdge = viewport?.offsetLeft || 0;
    const topEdge = viewport?.offsetTop || 0;
    const width = viewport?.width || window.innerWidth;
    const available = Math.max(0, anchor.top - topEdge - 16);
    const panelWidth = Math.min(anchor.width, width - 24);
    host.style.width = `${panelWidth}px`;
    host.style.left = `${Math.max(leftEdge + 12, Math.min(anchor.left, leftEdge + width - panelWidth - 12))}px`;
    host.style.maxHeight = `${Math.min(420, available)}px`;
    host.style.top = `${Math.max(topEdge + 8, anchor.top - Math.min(host.scrollHeight, 420, available) - 8)}px`;
  }
  function paint(scrollActive = true) {
    if (!view || scope.disposed) return;
    host.hidden = false;
    flushSync(() => root.render(<CommandPanel view={view!} choose={index => void choose(index)} activate={activate} />));
    const list = !view.help;
    input.setAttribute('aria-expanded', 'true');
    if (list) input.setAttribute('aria-controls', 'command-options'); else input.removeAttribute('aria-controls');
    if (list && view.items[view.active]) input.setAttribute('aria-activedescendant', `command-option-${view.active}`);
    else input.removeAttribute('aria-activedescendant');
    position();
    if (scrollActive) host.querySelector(`[id="command-option-${view.active}"]`)?.scrollIntoView({ block: 'nearest' });
  }
  function activate(index: number) {
    if (!view || view.active === index || !view.items[index]) return;
    view.active = index;
    navigated = true;
    paint(false);
  }
  function show(next: PanelView, nextMode: typeof mode) {
    if (!view) beforeOpen();
    view = next; mode = nextMode; owner = context()?.conversationId || ''; navigated = false; paint();
  }
  function report(message: string, error = false) {
    clearTimeout(feedbackTimer);
    flushSync(() => feedbackRoot.render(<>
      <TrustedIcon name={error ? 'alert' : 'check'} size={14} className="compress-notice-icon" aria-hidden="true" />
      <StatusText className="compress-notice-action">{message}</StatusText>
    </>));
    feedback.hidden = false;
    feedback.dataset.tone = error ? 'error' : 'success';
    feedback.classList.toggle('is-error', error);
    feedback.scrollIntoView({ block: 'nearest' });
    feedbackTimer = scope.timeout(() => { feedback.hidden = true; }, error ? 10000 : 6000);
  }
  function setText(text: string) {
    input.value = text; input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus({ preventScroll: true }); input.setSelectionRange(text.length, text.length);
  }
  function clearIfUnchanged(id: string, text: string, revision: number) {
    if (!scope.disposed && context()?.conversationId === id && input.value === text && version === revision) setText('');
  }
  function showOptions(result: Extract<CommandResult, { status: 'select' }>, ctx: CommandContext, explicit = false) {
    selectionReady = explicit;
    const parsed = parseCommandInput(input.value);
    const commandIcon = parsed.kind === 'command' ? registry.get(parsed.name)?.icon : undefined;
    options = result.options;
    show({ title: result.title, items: options.map(item => ({ ...item, icon: commandIcon })), active: Math.max(0, options.findIndex(item => item.selected)), message: result.message || (!options.length ? '没有匹配项，请修改参数或在设置中配置模型。' : undefined), busy: ctx.busy }, 'options');
  }
  async function finish(action: () => CommandResult | Promise<CommandResult>, ctx: CommandContext) {
    const text = input.value; const revision = version;
    try {
      const result = await action();
      if (scope.disposed || context()?.conversationId !== ctx.conversationId || input.value !== text || version !== revision) return;
      if (result.status === 'select') { showOptions(result, context() || ctx, true); return; }
      if (result.status === 'help') {
        clearIfUnchanged(ctx.conversationId, text, revision);
        show({ title: '指令帮助', items: [], active: 0, help: result.lines, busy: ctx.busy }, 'help'); return;
      }
      close(true);
      if (result.status === 'success') clearIfUnchanged(ctx.conversationId, text, revision);
      report(result.message, result.status !== 'success');
    } catch (error) {
      if (!scope.disposed && context()?.conversationId === ctx.conversationId && version === revision) {
        close(true); report(error instanceof Error ? error.message : '指令执行失败，请重试。', true);
      }
    }
  }
  async function submit(): Promise<boolean> {
    const parsed = parseCommandInput(input.value);
    if (parsed.kind !== 'command') return false;
    const ctx = context();
    if (!ctx) { report('请先创建或选择会话。', true); return true; }
    const command = registry.get(parsed.name);
    if (!command) { close(true); report('未知指令。输入 /help 查看帮助；使用 // 前缀发送字面量。', true); return true; }
    const unavailable = command.available(ctx);
    if (unavailable) { close(true); report(unavailable, true); return true; }
    close();
    await finish(() => command.execute(ctx, parsed.argument), ctx);
    return true;
  }
  async function choose(index: number) {
    const ctx = context();
    if (!ctx || ctx.conversationId !== owner) { close(); return; }
    if (mode === 'suggestions') {
      const command = suggestions[index]; if (!command) return;
      setText(`/${command.name}${command.options ? ' ' : ''}`);
      if (command.options) showOptions({ status: 'select', title: command.description, options: command.options(ctx, '') }, ctx);
      else { close(true); report(`已补全 /${command.name}，再次按 Enter 执行。`); }
    } else if (mode === 'options') {
      const option = options[index]; if (!option) return;
      await finish(() => option.choose(), ctx);
    }
  }
  function update() {
    version++; selectionReady = false; feedback.hidden = true;
    const parsed = parseCommandInput(input.value); const ctx = context();
    if (composing || parsed.kind !== 'command' || !ctx) { close(); return; }
    const command = registry.get(parsed.name);
    if (command?.options && parsed.hasSeparator) {
      showOptions({ status: 'select', title: command.description, options: command.options(ctx, parsed.argument) }, ctx);
    } else if (!parsed.argument) {
      suggestions = ordered().filter(item => `${item.name} ${item.label || ""} ${item.description}`.toLowerCase().includes(parsed.name));
      show({ title: '指令', items: suggestions.map(item => ({ id: item.id, label: item.label || `/${item.name}`, icon: item.icon, command: `/${item.name}`, detail: [item.description, item.summary?.(ctx)].filter(Boolean).join(" · "), unavailable: item.available(ctx) })), active: 0,
        message: suggestions.length ? undefined : '没有匹配指令。输入 /help 查看帮助。', busy: ctx.busy }, 'suggestions');
    } else close();
  }
  function keydown(event: KeyboardEvent): boolean {
    if (event.isComposing || composing) return false;
    if (event.key === 'Escape' && view) { event.preventDefault(); close(true); return true; }
    if (!view || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
    if (mode === 'help' && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const step = event.key.startsWith('Page') ? host.clientHeight * 0.8 : 40;
      if (event.key === 'Home') host.scrollTop = 0;
      else if (event.key === 'End') host.scrollTop = host.scrollHeight;
      else host.scrollTop += ['ArrowDown', 'PageDown'].includes(event.key) ? step : -step;
      return true;
    }
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && view.items.length) {
      event.preventDefault(); navigated = true;
      view.active = (view.active + (event.key === 'ArrowDown' ? 1 : -1) + view.items.length) % view.items.length; paint(); return true;
    }
    if (['Enter', 'Tab'].includes(event.key) && view.items.length) {
      const parsed = parseCommandInput(input.value);
      if (mode === 'suggestions' || event.key === 'Tab' || navigated || selectionReady || (parsed.kind === 'command' && !parsed.argument)) {
        event.preventDefault();
        if (event.key === 'Tab' && mode === 'options' && parsed.kind === 'command') {
          const option = options[view.active];
          if (option) setText(`/${parsed.name} ${option.argument}`);
        } else void choose(view.active);
        return true;
      }
    }
    return false;
  }
  scope.listen(input, 'input', update);
  scope.listen(input, 'compositionstart', () => { composing = true; close(); });
  scope.listen(input, 'compositionend', () => { composing = false; update(); });
  scope.listen(document, 'pointerdown', event => {
    if (view && event.target !== input && !host.contains(event.target as Node)) close();
  });
  scope.listen(window, 'resize', position);
  scope.listen(window, 'scroll', position, true);
  scope.listen(window.visualViewport, 'resize', position);
  scope.listen(window.visualViewport, 'scroll', position);
  return {
    submit, keydown,
    isCommand: () => parseCommandInput(input.value).kind === 'command',
    synchronize() {
      const next = context();
      const nextId = next?.conversationId || '';
      if (nextId !== lastContextId) {
        lastContextId = nextId;
        close(); feedback.hidden = true; version++; owner = '';
      } else if (view && next && view.busy !== next.busy) {
        view.busy = next.busy;
        if (mode === 'suggestions') view.items = suggestions.map(item => ({ id: item.id, label: item.label || `/${item.name}`, icon: item.icon, command: `/${item.name}`, detail: [item.description, item.summary?.(next)].filter(Boolean).join(' · '), unavailable: item.available(next) }));
        scope.frame(() => paint());
      }
    },
    close,
    dispose() {
      if (disposed) return;
      disposed = true;
      scope.dispose(); close(); queueMicrotask(() => { root.unmount(); feedbackRoot.unmount(); }); host.remove(); feedback.remove();
    }
  };
}
