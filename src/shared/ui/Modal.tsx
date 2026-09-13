import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { dialogStore } from '../overlays/dialog-service';
import { Button } from './primitives';
import { TrustedIcon } from './Icon';

/** Reusable secondary workspace, suspended while a confirmation dialog is open. */
export function Modal({ title, onClose, children, className = '', returnFocusFallback }: {
  title: string; onClose: () => void; children: ReactNode; className?: string; returnFocusFallback?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const confirmation = useSyncExternalStore(dialogStore.subscribe, dialogStore.getSnapshot, dialogStore.getServerSnapshot);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('[data-modal-autofocus], button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (dialogStore.getSnapshot() || event.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      // Keep app navigation shortcuts from moving focus behind this workspace.
      if ((event.metaKey || event.ctrlKey) && ['k', 'n', '\\'].includes(event.key.toLowerCase())) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.key !== 'Tab') return;
      const items = [...(ref.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])') || [])]
        .filter(node => !node.hasAttribute('disabled') && node.getClientRects().length > 0);
      if (!items.length) return;
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (index < 0 || (event.shiftKey ? index === 0 : index === items.length - 1)) {
        event.preventDefault(); items[event.shiftKey ? items.length - 1 : 0].focus();
      }
    };
    const navigate = () => close.current();
    const keepFocus = (event: FocusEvent) => {
      if (!dialogStore.getSnapshot() && ref.current && !ref.current.contains(event.target as Node)) ref.current.querySelector<HTMLElement>('button')?.focus();
    };
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', keepFocus);
    window.addEventListener('hashchange', navigate);
    return () => {
      document.documentElement.style.overflow = overflow;
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('focusin', keepFocus);
      window.removeEventListener('hashchange', navigate);
      if (previous?.isConnected) previous.focus();
      else if (returnFocusFallback) document.querySelector<HTMLElement>(returnFocusFallback)?.focus();
    };
  }, [returnFocusFallback]);
  const host = document.getElementById('modalHost');
  if (!host) return null;
  return createPortal(<div className="dialog-backdrop ui-modal-backdrop" inert={!!confirmation}
    onMouseDown={event => { if (event.target === event.currentTarget && !confirmation) onClose(); }}>
    <div ref={ref} className={`dialog-card ui-modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="ui-modal-header"><h2 className="dialog-title">{title}</h2>
        <Button className="icon-btn" aria-label={`关闭${title}`} title={`关闭${title}`} onClick={onClose}><TrustedIcon name="close" size={18} /></Button>
      </div>
      <div className="ui-modal-body">{children}</div>
    </div>
  </div>, host);
}
