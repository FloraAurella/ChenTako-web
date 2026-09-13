import { Button, TextField, Surface } from "../../../shared/ui/primitives";
import { TrustedIcon } from "../../../shared/ui/Icon";
import { useEffect, useRef, useState } from "react";
import { RESPONSE_FORMATS } from "../../../shared/settings/settings-view-model";
import { formatTokenLimit, resolveEffectiveModelConfig } from "../domain/models.js";
import type { SettingsService } from "../../settings/public/services_settings-service";
import type { ProviderEditingState } from "../../../contracts/settings";

const FORMAT_LABELS: Record<string, string> = { responses: "RSP", anthropic: "ANT", google: "GGL", "openai-compatible": "OAI" };

function noKeyRequired(provider: any) {
  return /api\.test-chatbox\.florasunshina\.io|localhost|127\.0\.0\.1|\[::1\]/i.test(String(provider.baseUrl || ""));
}

function ProviderRail({ providers, selectedId, onSelect }: {
  providers: any[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return <aside className="provider-rail" aria-label="已配置供应商">
    <div className="provider-rail-title"><span>已配置供应商</span><span>{providers.length}</span></div>
    <div className="provider-rail-list" tabIndex={0} role="region" aria-label="供应商列表">
      {providers.map((provider) => <Button
        type="button"
        className={`provider-item${selectedId === provider.id ? " is-selected" : ""}`}
        data-edit-provider={provider.id}
        aria-current={selectedId === provider.id ? "true" : undefined}
        key={provider.id}
        onClick={() => onSelect(provider.id)}
      >
        <span className="provider-format">{FORMAT_LABELS[provider.responseFormat] || "OAI"}</span>
        <span className="provider-main">
          <span className="provider-name">{provider.displayName}</span>
          <span className="provider-rail-status"><i data-enabled={provider.enabled !== false} />{provider.enabled === false ? "已禁用" : "已启用"}</span>
        </span>
      </Button>)}
      {!providers.length ? <p className="provider-rail-empty">暂无供应商</p> : null}
    </div>
  </aside>;
}

function KeyStatus({ editing }: { editing: ProviderEditingState }) {
  if (editing.apiKeyLoading) return <span className="provider-sync-state is-busy">正在读取 Key…</span>;
  if (editing.apiKeySyncing) return <span className="provider-sync-state is-busy">正在同步 Key…</span>;
  if (editing.apiKeyDirty) return <span className="provider-sync-state is-warning">Key 等待同步</span>;
  if (noKeyRequired(editing.draft)) return <span className="provider-sync-state is-ok">此端点不需要 Key</span>;
  return <span className={`provider-sync-state${editing.draft.hasKeyConfigured ? " is-ok" : " is-warning"}`}>
    {editing.draft.hasKeyConfigured ? "Key 已配置" : "Key 未配置"}
  </span>;
}

function ConnectionSection({ editing, service }: { editing: ProviderEditingState; service: SettingsService }) {
  const draft = editing.draft;
  return <section className="provider-section" aria-label="连接配置" onCompositionStart={() => service.providers.setComposing(true)} onCompositionEnd={() => service.providers.setComposing(false)} onBlur={() => void service.providers.save()}>
    <div className="provider-form-grid">
      <div><label className="field-label" htmlFor="pf-name">显示名称</label><TextField id="pf-name" className="field" value={draft.displayName} maxLength={80} onChange={(event) => service.providers.setField("displayName", event.currentTarget.value)} /></div>
      <div><label className="field-label" htmlFor="pf-format">API 格式</label><select id="pf-format" className="field select-field" value={draft.responseFormat} onChange={(event) => service.providers.setField("responseFormat", event.currentTarget.value)}>{RESPONSE_FORMATS.map((format: any) => <option key={format.key} value={format.key}>{format.label}</option>)}</select></div>
      <div className="provider-field-wide"><label className="field-label" htmlFor="pf-url">API Base URL</label><TextField id="pf-url" className="field" value={draft.baseUrl} placeholder="https://api.example.com/v1" onChange={(event) => service.providers.setField("baseUrl", event.currentTarget.value)} /></div>
      <div className="provider-field-wide"><div className="provider-field-label-row" title="修改自动保存"><label className="field-label" htmlFor="pf-key">API Key</label><KeyStatus editing={editing} /></div><div className="provider-key-row"><TextField id="pf-key" className="field" type={editing.apiKeyVisible ? "text" : "password"} value={editing.apiKey} placeholder={editing.apiKeyLoading ? "正在读取已保存 Key…" : draft.hasKeyConfigured ? "已保存 Key" : "尚未保存"} autoComplete="new-password" autoCapitalize="none" spellCheck={false} aria-busy={editing.apiKeyLoading || editing.apiKeySyncing} onChange={(event) => service.providers.setField("apiKey", event.currentTarget.value)} /><Button type="button" className="icon-btn provider-key-visibility" id="pf-key-visibility" disabled={editing.apiKeyLoading} onClick={() => void service.providers.toggleKeyVisibility()} title={editing.apiKeyVisible ? "隐藏 Key" : "显示 Key"} aria-label={editing.apiKeyVisible ? "隐藏 Key" : "显示 Key"}><TrustedIcon name="eye" size={17} /></Button></div></div>
    </div>
  </section>;
}

function ModelTest({ model, service }: { model: string; service: SettingsService }) {
  const request = useRef<AbortController | null>(null);
  const [result, setResult] = useState({ busy: false, message: "", error: false });
  useEffect(() => () => { request.current?.abort(); }, []);
  const run = async () => {
    if (request.current) { request.current.abort(); request.current = null; setResult({ busy: false, message: "已取消", error: false }); return; }
    const controller = new AbortController();
    request.current = controller;
    setResult({ busy: true, message: "测试中…", error: false });
    try {
      const message = await service.providers.testModel(model, controller.signal);
      if (!controller.signal.aborted) setResult({ busy: false, message, error: false });
    } catch (error) {
      if (!controller.signal.aborted) setResult({ busy: false, message: error instanceof Error ? error.message : String(error), error: true });
    } finally { if (request.current === controller) request.current = null; }
  };
  return <>
    <Button type="button" className="icon-btn small" title={result.busy ? "取消测试" : "测试模型"} aria-label={result.busy ? "取消测试" : "测试模型"} onClick={() => void run()}><TrustedIcon name={result.busy ? "stop" : "connection"} size={14} /></Button>
    {result.message ? <span className="provider-model-test-result" data-tone={result.error ? "error" : "success"} role={result.error ? "alert" : "status"}>{result.message}</span> : null}
  </>;
}

function ModelRow({ model, draft, service }: { model: string; draft: any; service: SettingsService }) {
  const effective = { ...resolveEffectiveModelConfig(draft, model), ...service.providers.capabilities(draft.id, model) };
  return <div className="provider-model-row" data-model-row={model}>
    <Surface className="provider-model-summary" title={`${model} · 最大输出 ${formatTokenLimit(effective.maxTokens)}${draft.defaultModel === model ? " · 默认模型" : ""}`}>
      <span className="provider-model-id">{model}</span>
      <span className="provider-model-badges">
        {effective.visionInput === true ? <span className="model-capability-badge">视觉</span> : null}
        {effective.imageOutput === true ? <span className="model-capability-badge">出图</span> : null}
        <span className="model-capability-badge" aria-label={`上下文 ${formatTokenLimit(effective.contextWindow)}`}>{formatTokenLimit(effective.contextWindow)}</span>
      </span>
    </Surface>
    <ModelTest key={JSON.stringify([draft.id, draft.baseUrl, draft.responseFormat, model])} model={model} service={service} />
    <Button type="button" className="icon-btn small provider-model-edit" title="编辑模型" aria-label="编辑模型" onClick={() => service.providers.openModel(model)}><TrustedIcon name="edit" size={16} /></Button>
  </div>;
}

function ModelsSection({ editing, service }: { editing: ProviderEditingState; service: SettingsService }) {
  return <section className="provider-section" aria-labelledby="provider-models-title">
    <div className="provider-section-head provider-model-section-head"><div><h3 id="provider-models-title">模型配置</h3></div><div className="provider-section-actions"><Button type="button" className="btn btn-ghost compact" onClick={service.providers.openModelDefaults}>模型默认值</Button><Button type="button" className="btn btn-secondary compact" id="pf-models-fetch" disabled={editing.testing} onClick={() => void service.providers.testConnection({ fetchModels: true })}><TrustedIcon name="refresh" size={14} />{editing.testing ? "读取中…" : "从接口读取"}</Button></div></div>
    <div className="provider-model-list">{editing.draft.models.length ? editing.draft.models.map((model: string) => <ModelRow key={model} model={model} draft={editing.draft} service={service} />) : <div className="provider-model-empty"><TrustedIcon name="spark" size={20} /><p>暂无模型，可添加或从接口读取。</p></div>}</div>
    <Button type="button" className="provider-add-model" id="pf-model-add" onClick={service.providers.openNewModel}><TrustedIcon name="plus" size={15} />添加模型</Button>
  </section>;
}

function ProviderDetail({ editing, service, onRemove }: { editing: ProviderEditingState; service: SettingsService; onRemove: () => void }) {
  const draft = editing.draft;
  return <main className="provider-detail" tabIndex={0} aria-label="供应商详情">
    <header className="provider-detail-head"><div><div className="provider-detail-title-row"><Button type="button" className="icon-btn small provider-back-to-list" aria-label="返回供应商列表" onClick={() => { location.hash = "#/settings/providers"; }}><TrustedIcon name="chevronLeft" size={16} /></Button><h3>{draft.displayName || "未命名供应商"}</h3><span className={`provider-enabled-badge${draft.enabled === false ? " is-disabled" : ""}`}>{draft.enabled === false ? "已禁用" : "已启用"}</span><Button type="button" className="toggle" role="switch" aria-label="允许用于聊天" title="允许用于聊天" id="pf-enabled" aria-checked={draft.enabled !== false} onClick={() => service.providers.toggleFlag("enabled")} /><span className="provider-auto-state" role="status">{editing.saving ? "保存中…" : editing.saveError ? "保存失败" : editing.dirty || editing.mode === "new" ? "等待保存" : "已保存"}</span></div></div><Button type="button" className="icon-btn danger" id="pf-delete" title={editing.mode === "new" ? "取消添加供应商" : "删除供应商"} aria-label={editing.mode === "new" ? "取消添加供应商" : "删除供应商"} onClick={onRemove}><TrustedIcon name="trash" size={17} /></Button></header>
    {editing.saveError ? <div className="provider-auto-error" role="alert"><span>{editing.saveError}</span><Button type="button" className="btn btn-secondary compact" disabled={editing.saving} onClick={() => void service.providers.save()}>重试</Button></div> : null}
    <ConnectionSection editing={editing} service={service} />
    <ModelsSection editing={editing} service={service} />

    {editing.testResult ? <p className="provider-fetch-result" data-tone={editing.testResultTone} role={editing.testResultTone === "error" ? "alert" : "status"}>{editing.testResult}</p> : null}
  </main>;
}

export function ProviderWorkspace({ providers, editing, service, routeProviderId, onSelect, onRemove }: {
  providers: any[];
  editing: ProviderEditingState | null;
  service: SettingsService;
  routeProviderId: string;
  onSelect: (id: string) => void;
  onRemove: () => void;
}) {
  const selectedId = editing?.mode === "edit" ? editing.draft.id : routeProviderId;
  return <div className={`provider-registry${editing ? " has-detail" : ""}`}>
    <ProviderRail providers={providers} selectedId={selectedId} onSelect={onSelect} />
    {editing ? <ProviderDetail editing={editing} service={service} onRemove={onRemove} /> : <div className="provider-detail-empty"><TrustedIcon name="key" size={28} /><h3>选择一个供应商</h3></div>}
  </div>;
}
