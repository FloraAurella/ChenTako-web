import { useSyncExternalStore } from "react";
import { TrustedIcon } from "../ui/Icon";
import { clearInlineError, inlineErrorStore } from "./inline-error-service";

export function InlineErrorLine({ className = "", active = true }: { className?: string; active?: boolean }) {
  const item = useSyncExternalStore(
    inlineErrorStore.subscribe,
    inlineErrorStore.getSnapshot,
    inlineErrorStore.getServerSnapshot
  );
  if (!active || !item) return null;
  return <div
    className={`inline-error-line${className ? ` ${className}` : ""}`}
    role="alert"
    aria-live="assertive"
    aria-atomic="true"
    data-error-id={item.id}
  >
    <TrustedIcon name="alert" size={14} className="inline-error-icon" />
    <span className="inline-error-message">{item.message}</span>
    <button type="button" className="inline-error-dismiss" aria-label="关闭错误信息" onClick={clearInlineError}>
      <TrustedIcon name="close" size={13} />
    </button>
  </div>;
}
