import { useRef, type PointerEvent } from 'react';
import { Surface, ListItem } from '../../../shared/ui/primitives';
import { icon } from '../../../resources/icons/index.js';
export interface PanelItem { id: string; label: string; detail: string; icon?: string; command?: string; selected?: boolean; unavailable?: string | null }
export interface PanelView {
  title: string; items: PanelItem[]; active: number; message?: string; help?: string[]; busy: boolean;
}
export function CommandPanel({ view, choose, activate }: { view: PanelView; choose(index: number): void; activate(index: number): void }) {
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  function trackPointer(event: PointerEvent<HTMLButtonElement>, index: number) {
    if (event.pointerType === 'touch') return;
    const previous = lastPointer.current;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    // Layout changes under a stationary pointer must not undo keyboard navigation.
    if (!previous || previous.x !== event.clientX || previous.y !== event.clientY) activate(index);
  }
  return <Surface className="command-panel" aria-label={view.title}>
    {view.help && <div className="command-panel-heading">{view.title}</div>}
    {view.message && <p className="command-panel-message" role="status">{view.message}</p>}
    {view.help ? <div className="command-help">{view.help.map((line, index) => <p key={index}>{line}</p>)}</div> :
      <div role="listbox" id="command-options" aria-label={view.title}>
        {view.items.map((item, index) => <ListItem key={item.id} id={`command-option-${index}`} role="option"
          aria-selected={index === view.active} aria-disabled={Boolean(item.unavailable)} tabIndex={-1}
          className={`ui-menu-item command-option ${index === view.active ? 'is-active' : ''}`}
          onPointerMove={event => trackPointer(event, index)}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
          <span className="command-option-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon(item.icon || 'chevronRight', 16) }} />
          <span className="command-option-copy"><span className="command-option-title" title={item.command}>{item.label}</span>
          <span className="command-option-detail">{item.unavailable || item.detail}</span></span>
          {item.selected && <span className="command-option-check" aria-label="当前" role="img" dangerouslySetInnerHTML={{ __html: icon('check', 16) }} />}
        </ListItem>)}
      </div>}
  </Surface>;
}
