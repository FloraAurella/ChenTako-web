import { Button, TextField } from "../../../shared/ui/primitives";
import { TrustedIcon } from "../../../shared/ui/Icon";
import { ToggleSetting } from "../../../shared/settings/shared";
import { RESPONSE_FORMATS } from "../../../shared/settings/settings-view-model";
import { formatTokenLimit, resolveEffectiveModelConfig } from "../domain/models.js";
import type { SettingsService } from "../../settings/public/services_settings-service";
import type { ProviderEditingState } from "../../../contracts/settings";

const FORMAT_LABELS: Record<string, string> = { responses: "RSP", anthropic: "ANT", google: "GGL", "openai-compatible": "OAI" };
const FORMAT_NAMES: Record<string, string> = Object.fromEntries(RESPONSE_FORMATS.map((entry: any) => [entry.key, entry.label]));

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
    <div className="provider-rail-list">
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
      {!providers.length ? <p className="provider-rail-empty">还没有供应商，请添加一个 API 协议。</p> : null}
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
  return <section className="provider-section" aria-labelledby="provider-connection-title">
    <div className="provider-section-head"><div><h3 id="provider-connection-title">连接配置</h3><p>设置 API 地址、协议和凭据。</p></div></div>
    <div className="provider-form-grid">
      <div><label className="field-label" htmlFor="pf-name">显示名称</label><TextField id="pf-name" className="field" value={draft.displayName} maxLength={80} onChange={(event) => service.providers.setField("displayName", event.currentTarget.value)} /></div>
      <div><label className="field-label" htmlFor="pf-format">API 格式</label><select id="pf-format" className="field select-field" value={draft.responseFormat} onChange={(event) => service.providers.setField("responseFormat", event.currentTarget.value)}>{RESPONSE_FORMATS.map((format: any) => <option key={format.key} value={format.key}>{format.label}</option>)}</select></div>
      <div className="provider-field-wide"><label className="field-label" htmlFor="pf-url">API Base URL</label><TextField id="pf-url" className="field" value={draft.baseUrl} placeholder="https://api.example.com/v1" onChange={(event) => service.providers.setField("baseUrl", event.currentTarget.value)} /></div>
      <div className="provider-field-wide"><div className="provider-field-label-row"><label className="field-label" htmlFor="pf-key">API Key</label><KeyStatus editing={editing} /></div><div className="provider-key-row"><TextField id="pf-key" className="field" type={editing.apiKeyVisible ? "text" : "password"} value={editing.apiKey} placeholder={editing.apiKeyLoading ? "正在读取已保存 Key…" : draft.hasKeyConfigured ? "已保存 Key" : "尚未保存"} autoComplete="new-password" autoCapitalize="none" spellCheck={false} aria-busy={editing.apiKeyLoading || editing.apiKeySyncing} onChange={(event) => service.providers.setField("apiKey", event.currentTarget.value)} /><Button type="button" className="icon-btn provider-key-visibility" id="pf-key-visibility" disabled={editing.apiKeyLoading} onClick={() => void service.providers.toggleKeyVisibility()} title={editing.apiKeyVisible ? "隐藏 Key" : "显示 Key"} aria-label={editing.apiKeyVisible ? "隐藏 Key" : "显示 Key"}><TrustedIcon name="eye" size={17} /></Button></div><p className="field-help">API Key 会立即同步，其他设置需手动保存。</p></div>
    </div>
    <ToggleSetting id="pf-enabled" label="允许用于聊天" hint="禁用后不再出现在模型选择器中。" checked={draft.enabled !== false} onClick={() => service.providers.toggleFlag("enabled")} />
  </section>;
}

function ModelRow({ model, draft, service }: { model: string; draft: any; service: SettingsService }) {
  const effective = { ...resolveEffectiveModelConfig(draft, model), ...service.providers.capabilities(draft.id, model) };
  const customized = [effective.sources.contextWindow, effective.sources.maxTokens].includes("model");
  return <div className="provider-model-row" data-model-row={model}>
    <Button type="button" className="provider-model-main" aria-label="编辑模型" title="编辑模型" onClick={() => service.providers.openModel(model)}>
      <span className="provider-model-id">{model}</span>
      <span className="provider-model-meta">
        <span>{formatTokenLimit(effective.contextWindow)} context</span>
        <span>{formatTokenLimit(effective.maxTokens)} output</span>
        <span>{customized ? "自定义" : "继承默认"}</span>
      </span>
    </Button>
    <div className="provider-model-badges">
      {draft.defaultModel === model ? <span className="model-default-flag">默认</span> : null}

      {effective.visionInput === true ? <span className="model-capability-badge">看图</span> : null}
      {effective.imageOutput === true ? <span className="model-capability-badge">出图</span> : null}
    </div>
    <div className="provider-model-actions">
      {draft.defaultModel !== model ? <Button type="button" className="icon-btn small" title="设为默认模型" aria-label="设为默认模型" onClick={() => service.providers.setDefaultModel(model)}><TrustedIcon name="check" size={14} /></Button> : null}
      <Button type="button" className="icon-btn small danger" title="删除模型" aria-label="删除模型" onClick={() => void service.providers.removeModel(model)}><TrustedIcon name="trash" size={14} /></Button>
    </div>
  </div>;
}

function ModelsSection({ editing, service }: { editing: ProviderEditingState; service: SettingsService }) {
  return <section className="provider-section" aria-labelledby="provider-models-title">
    <div className="provider-section-head provider-model-section-head"><div><h3 id="provider-models-title">模型配置</h3><p>设置模型参数，未配置项继承默认值。</p></div><div className="provider-section-actions"><Button type="button" className="btn btn-ghost compact" onClick={service.providers.openModelDefaults}>模型默认值</Button><Button type="button" className="btn btn-secondary compact" id="pf-models-fetch" disabled={editing.testing} onClick={() => void service.providers.testConnection({ fetchModels: true })}><TrustedIcon name="refresh" size={14} />{editing.testing ? "读取中…" : "从接口读取"}</Button></div></div>
    <div className="provider-model-list">{editing.draft.models.length ? editing.draft.models.map((model: string) => <ModelRow key={model} model={model} draft={editing.draft} service={service} />) : <div className="provider-model-empty"><TrustedIcon name="spark" size={20} /><p>尚未添加模型，可手动添加或从接口读取。</p></div>}</div>
    <Button type="button" className="provider-add-model" id="pf-model-add" onClick={service.providers.openNewModel}><TrustedIcon name="plus" size={15} />添加模型</Button>
  </section>;
}

function ProviderDetail({ editing, service, onSave, onRemove }: { editing: ProviderEditingState; service: SettingsService; onSave: () => void; onRemove: () => void }) {
  const draft = editing.draft;
  return <main className="provider-detail">
    <header className="provider-detail-head"><div><div className="provider-detail-title-row"><h3>{draft.displayName || "未命名供应商"}</h3><span className={`provider-enabled-badge${draft.enabled === false ? " is-disabled" : ""}`}>{draft.enabled === false ? "已禁用" : "已启用"}</span>{editing.dirty || editing.mode === "new" ? <span className="provider-dirty-badge">未保存</span> : null}</div><p>{FORMAT_NAMES[draft.responseFormat] || draft.responseFormat} · {draft.models.length} 个模型</p></div></header>
    <ConnectionSection editing={editing} service={service} />
    <ModelsSection editing={editing} service={service} />
    <section className="provider-section"><h3>供应商管理</h3><p className="field-help">提示词、生成参数与模型兼容性请前往“上下文与提示词”设置。</p>{editing.mode === "edit" ? <Button type="button" className="provider-delete-link" id="pf-delete" onClick={onRemove}>删除这个供应商</Button> : null}</section>
    <footer className="provider-savebar"><div className="provider-save-state"><i data-dirty={editing.dirty || editing.mode === "new"} />{editing.dirty || editing.mode === "new" ? "连接配置有未保存的更改" : "连接配置已保存"}{editing.testResult ? <small data-tone={editing.testResultTone || "info"} role={editing.testResultTone === "error" ? "alert" : undefined}>{editing.testResult}</small> : null}</div><div className="provider-save-actions"><Button type="button" className="btn btn-secondary" id="pf-test" disabled={editing.testing} onClick={() => void service.providers.testConnection()}>{editing.testing ? "测试中…" : "测试连接"}</Button><Button type="button" className="btn btn-ghost" id="pf-cancel" disabled={!editing.dirty && editing.mode !== "new"} onClick={() => void service.providers.discard()}>放弃更改</Button><Button type="button" className="btn btn-primary" id="pf-save" disabled={!editing.dirty && editing.mode !== "new"} onClick={onSave}>保存更改</Button></div></footer>
  </main>;
}

export function ProviderWorkspace({ providers, editing, service, routeProviderId, onSelect, onSave, onRemove }: {
  providers: any[];
  editing: ProviderEditingState | null;
  service: SettingsService;
  routeProviderId: string;
  onSelect: (id: string) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const selectedId = editing?.mode === "edit" ? editing.draft.id : routeProviderId;
  return <div className={`provider-registry${editing ? " has-detail" : ""}`}>
    <ProviderRail providers={providers} selectedId={selectedId} onSelect={onSelect} />
    {editing ? <ProviderDetail editing={editing} service={service} onSave={onSave} onRemove={onRemove} /> : <div className="provider-detail-empty"><TrustedIcon name="key" size={28} /><h3>选择一个供应商</h3><p>选择现有供应商或添加新供应商。</p></div>}
  </div>;
}
