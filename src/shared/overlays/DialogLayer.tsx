import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { LIGHT_TOKENS } from "../../modules/appearance/public/domain_base-themes.js";
import { icon } from "../../resources/icons/index.js";
import { dialogStore, settleDialog, type DialogRequest } from "./dialog-service";

const HTML_PREVIEW_CSP = [
  "default-src 'none'", "script-src 'none'", "connect-src 'none'", "img-src data: blob:",
  "media-src data: blob:", "font-src data:", "style-src 'unsafe-inline'", "object-src 'none'",
  "frame-src 'none'", "form-action 'none'", "base-uri 'none'", "navigate-to 'none'"
].join("; ");

function sandboxedPreviewDocument(source: string, format: "html" | "svg") {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const bg = style.getPropertyValue("--surface-content").trim();
  const fg = style.getPropertyValue("--label").trim();
  return [
    "<!doctype html>", '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_CSP}">`,
    '<meta name="referrer" content="no-referrer">',
    `<style>html{color-scheme:light}body{min-height:100vh;margin:0;background:${bg || LIGHT_TOKENS["--surface-content"]};color:${fg || LIGHT_TOKENS["--label"]}}${format === "svg" ? "body{display:grid;place-items:center;padding:24px;box-sizing:border-box}svg{display:block;max-width:100%;max-height:calc(100vh - 48px);height:auto}" : ""}</style>`,
    format === "svg" ? `<main class="svg-preview-root">${source}</main>` : source
  ].join("\n");
}

function useDialogFocus(request: DialogRequest, primaryRef: React.RefObject<HTMLElement | null>, inputRef?: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const primary = inputRef?.current || primaryRef.current;
    primary?.focus();
    inputRef?.current?.select();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        settleDialog(request.kind === "prompt" ? null : request.kind === "confirm" ? false : true);
        return;
      }
      if (event.key === "Enter" && request.kind !== "preview" && (!inputRef || event.target === inputRef.current)) {
        event.preventDefault();
        settleDialog(request.kind === "prompt" ? String(inputRef?.current?.value || "") : true);
        return;
      }
      if (event.key === "Tab") {
        const scope = primaryRef.current?.closest("[role='dialog']");
        const focusables = [...(scope?.querySelectorAll<HTMLElement>("button, input, [tabindex]:not([tabindex='-1'])") || [])]
          .filter((node) => !node.hasAttribute("disabled"));
        if (!focusables.length) return;
        const index = focusables.indexOf(document.activeElement as HTMLElement);
        event.preventDefault();
        focusables[event.shiftKey ? (index - 1 + focusables.length) % focusables.length : (index + 1) % focusables.length].focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [inputRef, primaryRef, request]);
}

function StandardDialog({ request }: { request: Extract<DialogRequest, { kind: "confirm" | "prompt" }> }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useDialogFocus(request, confirmRef, request.kind === "prompt" ? inputRef : undefined);
  const cancel = () => settleDialog(request.kind === "prompt" ? null : false);
  const confirm = () => settleDialog(request.kind === "prompt" ? String(inputRef.current?.value || "") : true);
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) cancel(); }}>
    <div className="dialog-card" role="dialog" aria-modal="true" aria-label={request.title}>
      <h3 className="dialog-title">{request.title}</h3>
      {request.message ? <p className="dialog-message">{request.message}</p> : null}
      {request.kind === "prompt" ? <div className="dialog-input-zone"><input ref={inputRef} className="field dialog-input" type="text" defaultValue={request.value} placeholder={request.placeholder} /></div> : null}
      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" data-role="cancel" onClick={cancel}>{request.cancelLabel}</button>
        <button ref={confirmRef} type="button" className={`btn ${request.danger ? "btn-destructive" : "btn-primary"}`} data-role="confirm" onClick={confirm}>{request.confirmLabel}</button>
      </div>
    </div>
  </div>;
}

function HtmlPreview({ request }: { request: Extract<DialogRequest, { kind: "preview" }> }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(request, closeRef);
  const close = () => settleDialog(true);
  return <div className="dialog-backdrop html-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="dialog-card html-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="html-preview-title" aria-describedby="html-preview-note">
      <div className="html-preview-head"><div><span className="html-preview-eyebrow">{request.format.toUpperCase()} · 只读沙箱</span><h3 className="dialog-title" id="html-preview-title">{request.title}</h3></div>
        <button ref={closeRef} type="button" className="icon-btn html-preview-close" data-role="close" title="关闭预览" aria-label="关闭预览" onClick={close} dangerouslySetInnerHTML={{ __html: icon("close", 17) }} />
      </div>
      <p className="html-preview-note" id="html-preview-note" dangerouslySetInnerHTML={{ __html: `${icon("shield", 13)} 脚本、网络、表单与父页面访问均已关闭` }} />
      <div className="html-preview-frame-shell"><iframe title={`${request.format.toUpperCase()} 预览内容`} sandbox="" referrerPolicy="no-referrer" tabIndex={-1} srcDoc={sandboxedPreviewDocument(request.source, request.format)} /></div>
    </div>
  </div>;
}

export function DialogLayer() {
  const request = useSyncExternalStore(dialogStore.subscribe, dialogStore.getSnapshot, dialogStore.getServerSnapshot);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("modalHost")), []);
  if (!host || !request) return null;
  return createPortal(request.kind === "preview" ? <HtmlPreview request={request} /> : <StandardDialog request={request} />, host);
}
