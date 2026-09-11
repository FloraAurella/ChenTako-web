import { Surface, ListItem, StatusText } from '../../../shared/ui/primitives';
export interface PanelItem { id: string; label: string; detail: string; selected?: boolean; unavailable?: string | null }
export interface PanelView {
  title: string; items: PanelItem[]; active: number; message?: string; help?: string[]; busy: boolean;
}
export function CommandPanel({ view, choose }: { view: PanelView; choose(index: number): void }) {
  return <Surface className="command-panel" aria-label={view.title}>
    <div className="command-panel-heading">{view.title}</div>
    {view.message && <p className="command-panel-message" role="status">{view.message}</p>}
    {view.help ? <div className="command-help">{view.help.map((line, index) => <p key={index}>{line}</p>)}</div> :
      <div role="listbox" id="command-options" aria-label={view.title}>
        {view.items.map((item, index) => <ListItem key={item.id} id={`command-option-${index}`} role="option"
          aria-selected={index === view.active} aria-disabled={Boolean(item.unavailable)} tabIndex={-1}
          className={`command-option ${index === view.active ? 'is-active' : ''}`}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
          <span className="command-option-title">{item.label}{item.selected && <StatusText>当前</StatusText>}</span>
          <span className="command-option-detail">{item.unavailable || item.detail}</span>
        </ListItem>)}
      </div>}
    <div className="command-panel-hint">{view.help ? '↑↓ / Page Up / Page Down 滚动帮助 · Esc 关闭' : view.busy ? '当前请求保持原配置 · Enter 执行指令 · 发送按钮仍用于停止回复' : '↑↓ 选择 · Tab 补全 · Enter 确认 · Esc 关闭'}</div>
  </Surface>;
}
