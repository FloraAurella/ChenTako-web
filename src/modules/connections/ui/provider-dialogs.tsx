import { Button, TextField } from "../../../shared/ui/primitives";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PROVIDER_PRESETS } from "../../../contracts/constants.js";
import type { SettingsService } from "../../settings/public/services_settings-service";
import type { ModelParameterKey, ProviderEditingState } from "../../../contracts/settings";
import { TrustedIcon } from "../../../shared/ui/Icon";

function useModalHost(onClose: () => void, initialFocusSelector: string) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => setHost(document.getElementById("modalHost")), []);
  useEffect(() => {
    if (!host) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>(initialFocusSelector)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((node) => !node.hasAttribute("disabled"));
      if (!focusable.length) return;
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      const nextIndex = index < 0
        ? (event.shiftKey ? focusable.length - 1 : 0)
        : event.shiftKey
          ? (index - 1 + focusable.length) % focusable.length
          : (index + 1) % focusable.length;
      focusable[nextIndex].focus();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown, true);
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [host, initialFocusSelector]);
  return { host, dialogRef };
}

const CREATE_TEMPLATES = [
  ...PROVIDER_PRESETS.map((preset: any) => ({ id: preset.id, code: "RSP", title: preset.label, description: "预填测试地址、test-1 与 test-2，无需 API Key。" })),
  { id: "blank-responses", code: "RSP", title: "OpenAI Responses", description: "自填 API 地址。" },
  { id: "blank-openai-compatible", code: "OAI", title: "OpenAI Chat Completions", description: "兼容 OpenAI 接口。" },
  { id: "blank-anthropic", code: "ANT", title: "Anthropic Messages", description: "预填官方地址。" },
  { id: "blank-google", code: "GGL", title: "Google Gemini", description: "预填官方地址。" }
];

export function ProviderCreateDialog({ onClose, onChoose }: { onClose: () => void; onChoose: (id: string) => void }) {
  const { host, dialogRef } = useModalHost(onClose, ".provider-template-card");
  if (!host) return null;
  return createPortal(<div className="dialog-backdrop provider-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className="dialog-card provider-create-dialog" role="dialog" aria-modal="true" aria-labelledby="provider-create-title">
      <div className="provider-dialog-head"><div><h3 className="dialog-title" id="provider-create-title">添加供应商</h3><p>选择供应商使用的 API 协议。</p></div><Button type="button" className="icon-btn" onClick={onClose} aria-label="关闭"><TrustedIcon name="close" size={17} /></Button></div>
      <div className="provider-template-grid">{CREATE_TEMPLATES.map((template) => <Button type="button" className="provider-template-card preset-chip" data-preset={template.id} key={template.id} onClick={() => onChoose(template.id)}><span className="provider-template-code">{template.code}</span><span><strong>{template.title}</strong><small>{template.description}</small></span><TrustedIcon name="chevronRight" size={16} /></Button>)}</div>
    </div>
  </div>, host);
}

function InheritableField({ id, label, parameter, value, inherited, type = "number", min, max, step, service }: {
  id: string;
  label: string;
  parameter: ModelParameterKey;
  value: string;
  inherited: boolean;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  service: SettingsService;
}) {
  return <div className="provider-model-field"><div className="provider-field-label-row"><label className="field-label" htmlFor={id}>{label}</label><label className="inherit-control"><TextField type="checkbox" checked={inherited} onChange={() => service.providers.toggleModelInheritance(parameter)} />使用模型默认值</label></div><TextField id={id} className="field" type={type} min={min} max={max} step={step} value={value} disabled={inherited} onChange={(event) => service.providers.setModelField(parameter, event.currentTarget.value)} /></div>;
}

export function ProviderModelDialog({ editing, service }: { editing: ProviderEditingState; service: SettingsService }) {
  const editor = editing.modelEditing!;
  const defaults = editor.mode === "defaults";
  const close = () => { if (!editing.saving) service.providers.closeModel(); };
  const { host, dialogRef } = useModalHost(close, defaults ? "#model-contextWindow" : "#model-id");
  const draft = editor.draft;
  if (!host) return null;
  const apply = () => { void service.providers.applyModel(); };
  return createPortal(<div className="dialog-backdrop provider-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialogRef} className="dialog-card provider-model-dialog" role="dialog" aria-modal="true" aria-labelledby="provider-model-dialog-title">
      <div className="provider-dialog-head"><div><h3 className="dialog-title" id="provider-model-dialog-title">{defaults ? "模型默认值" : editor.mode === "new" ? "添加模型" : "编辑模型配置"}</h3><p>{defaults ? "未自定义的模型使用这些默认值。" : "设置上下文与输出限额。"}</p></div><Button type="button" className="icon-btn" onClick={close} aria-label="关闭"><TrustedIcon name="close" size={17} /></Button></div>
      <fieldset className="provider-model-dialog-scroll" disabled={editing.saving}>
        {!defaults ? <div><label className="field-label" htmlFor="model-id">模型 ID</label><TextField id="model-id" className="field" value={draft.id} maxLength={200} autoComplete="off" onChange={(event) => service.providers.setModelField("id", event.currentTarget.value)} /></div> : null}
        {defaults ? <div className="provider-model-field"><label className="field-label" htmlFor="model-contextWindow">默认上下文窗口</label><TextField id="model-contextWindow" className="field" type="number" min={1} max={10000000} value={draft.contextWindow} onChange={(event) => service.providers.setModelField("contextWindow", event.currentTarget.value)} /></div> : <InheritableField id="model-contextWindow" label="上下文窗口" parameter="contextWindow" value={draft.contextWindow} inherited={draft.inherit.contextWindow} min={1} max={10000000} service={service} />}
        {defaults ? <div className="provider-model-field"><label className="field-label" htmlFor="model-maxTokens">默认最大输出 Token</label><TextField id="model-maxTokens" className="field" type="number" min={1} max={1000000} value={draft.maxTokens} onChange={(event) => service.providers.setModelField("maxTokens", event.currentTarget.value)} /></div> : <InheritableField id="model-maxTokens" label="最大输出 Token" parameter="maxTokens" value={draft.maxTokens} inherited={draft.inherit.maxTokens} min={1} max={1000000} service={service} />}
        {!defaults ? <label className="provider-default-choice"><TextField type="checkbox" checked={Boolean(draft.isDefault)} disabled={editing.draft.defaultModel === editor.originalId} onChange={event => service.providers.setModelField("isDefault", event.currentTarget.checked)} />用作默认模型</label> : null}
        {editor.error ? <p className="provider-model-error" role="alert">{editor.error}</p> : null}
      </fieldset>
      <div className="dialog-actions provider-dialog-actions">{editor.mode === "edit" ? <Button type="button" className="btn btn-ghost danger" disabled={editing.saving} onClick={() => void service.providers.removeModel(editor.originalId)}>删除模型</Button> : null}<Button type="button" className="btn btn-ghost" disabled={editing.saving} onClick={close}>取消</Button><Button type="button" className="btn btn-primary" disabled={editing.saving} onClick={apply}>{editing.saving ? "保存中…" : "保存更改"}</Button></div>
    </div>
  </div>, host);
}
