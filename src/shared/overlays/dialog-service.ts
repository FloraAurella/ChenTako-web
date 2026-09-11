export interface DialogOptions {
  title?: string;
  message?: string;
  value?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export type DialogRequest =
  | ({ id: number; kind: "confirm" | "prompt"; returnFocus: HTMLElement | null } & Required<DialogOptions>)
  | { id: number; kind: "preview"; source: string; format: "html" | "svg"; title: string; returnFocus: HTMLElement | null };

type Listener = () => void;
type Resolution = boolean | string | null;

const listeners = new Set<Listener>();
let active: DialogRequest | null = null;
let sequence = 0;
let resolver: ((value: Resolution) => void) | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function open(kind: "confirm" | "prompt", options: DialogOptions = {}) {
  if (active) settle(active.kind === "prompt" ? null : false);
  const request: DialogRequest = {
    id: ++sequence,
    kind,
    title: String(options.title || ""),
    message: String(options.message || ""),
    value: String(options.value || ""),
    placeholder: String(options.placeholder || ""),
    confirmLabel: String(options.confirmLabel || "确认"),
    cancelLabel: String(options.cancelLabel || "取消"),
    danger: options.danger === true,
    returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null
  };
  active = request;
  emit();
  return new Promise<Resolution>((resolve) => { resolver = resolve; });
}

function preview(source = "", format: "html" | "svg" = "html", title = "") {
  if (active) settle(active.kind === "prompt" ? null : false);
  active = {
    id: ++sequence,
    kind: "preview",
    source: String(source || ""),
    format,
    title: String(title || (format === "svg" ? "SVG 预览" : "HTML 预览")),
    returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null
  };
  emit();
  return new Promise<boolean>((resolve) => { resolver = (value) => resolve(value === true); });
}

export function settleDialog(value: Resolution) {
  const request = active;
  const resolve = resolver;
  active = null;
  resolver = null;
  emit();
  if (resolve) resolve(value);
  queueMicrotask(() => {
    if (request?.returnFocus && document.contains(request.returnFocus)) request.returnFocus.focus();
  });
}

function settle(value: Resolution) {
  settleDialog(value);
}

export const dialogStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => active,
  getServerSnapshot: () => null
};

export function createReactDialogManager() {
  return {
    confirm(options: DialogOptions) { return open("confirm", options) as Promise<boolean>; },
    prompt(options: DialogOptions) { return open("prompt", options) as Promise<string | null>; },
    previewHtml({ source = "", format = "html", title = "" }: { source?: string; format?: "html" | "svg"; title?: string } = {}) {
      return preview(source, format, title);
    }
  };
}
