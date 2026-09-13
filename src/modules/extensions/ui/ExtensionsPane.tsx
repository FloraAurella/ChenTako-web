import { Button, TextField, TextArea } from "../../../shared/ui/primitives";
import { TrustedIcon } from "../../../shared/ui/Icon";
import { useStoreValue, type ExternalStore } from "../../../shared/state/react";
import { ToggleSetting } from "../../../shared/settings/shared";
import type { SettingsService } from "../../settings/public/services_settings-service";
import type { SettingsState } from "../../../contracts/settings";

type Kind = "tool" | "skill";

const meta: Record<Kind, { title: string; card: string; desc: string; icon: string; key: string; action: string }> = {
  tool: { title: "工具", card: "自定义工具", desc: "", icon: "puzzle", key: "tools", action: "新增工具" },
  skill: { title: "技能", card: "技能", desc: "支持 Markdown（≤16KB）和 Skill 压缩包（≤5MB）。", icon: "spark", key: "skills", action: "导入技能" }
};

// 能力预留说明：配置入口保留，执行路径在本版本明确拒绝，避免误以为已可执行。
function CapabilityNote() {
  return <p className="settings-card-desc extension-capability-note" data-extension-capability>执行尚未开放；当前仅可管理配置，启用后相关请求会被拒绝。</p>;
}

function RuntimeSetting({ interpreter, checked, service }: { interpreter?: boolean; checked: boolean; service: SettingsService }) {
  const label = interpreter ? "Linux Python 代码解释器（内置 VM）" : "运行时沙箱（macOS）";
  return <div className={`runtime-sandbox-setting${interpreter ? " runtime-code-interpreter-setting" : ""}`}><span className="runtime-sandbox-mark"><TrustedIcon name="work" size={16} /></span><div className="runtime-sandbox-copy"><strong>{label}</strong></div><Button type="button" className="toggle runtime-sandbox-toggle" role="switch" aria-label={`${checked ? "停用" : "启用"}${label}`} aria-checked={checked} data-sandbox-toggle={!interpreter || undefined} data-code-interpreter-toggle={interpreter || undefined} onClick={() => service.extensions.toggleRuntime(interpreter ? "codeInterpreter" : "sandbox")} /></div>;
}

function Item({ kind, entry, service }: { kind: Kind; entry: any; service: SettingsService }) {
  const item = meta[kind];
  const text = kind === "tool" ? `POST · ${entry.endpoint || "未配置地址"}` : entry.description || "未填写适用说明";
  return <div className="extension-settings-item" data-extension-item={entry.id}><span className="extension-settings-icon"><TrustedIcon name={item.icon} size={15} /></span><div className="extension-settings-main"><div className="extension-settings-name">{entry.name}</div><div className="extension-settings-sub" title={text}>{text}</div></div><Button type="button" className="toggle extension-enabled-toggle" role="switch" aria-label={`${entry.enabled ? "停用" : "启用"}${item.card}「${entry.name}」`} aria-checked={entry.enabled} data-extension-toggle={kind} data-extension-id={entry.id} onClick={() => service.extensions.toggle(kind, entry.id)} />{kind === "skill" ? null : <Button type="button" className="icon-btn small" data-extension-edit={kind} data-extension-id={entry.id} title={`编辑${item.card}`} aria-label={`编辑${item.card}`} onClick={() => service.extensions.begin(kind, entry.id)}><TrustedIcon name="edit" size={14} /></Button>}<Button type="button" className="icon-btn small danger" data-extension-remove={kind} data-extension-id={entry.id} title={`删除${item.card}`} aria-label={`删除${item.card}`} onClick={() => void service.extensions.remove(kind, entry.id)}><TrustedIcon name="trash" size={14} /></Button></div>;
}

function SkillImport({ service }: { service: SettingsService }) {
  let markdown: HTMLInputElement | null = null;
  let zip: HTMLInputElement | null = null;
  return <div className="extension-import-actions"><Button type="button" className="btn btn-secondary extension-import-btn" id="skillMarkdownImportBtn" onClick={() => markdown?.click()}><TrustedIcon name="file" size={14} /> 上传 .md</Button><Button type="button" className="btn btn-primary extension-import-btn" id="skillZipImportBtn" onClick={() => zip?.click()}><TrustedIcon name="upload" size={14} /> 上传压缩包</Button><TextField id="skillMarkdownInput" className="visually-hidden" type="file" accept=".md,.markdown,text/markdown" multiple ref={(element) => { markdown = element; }} onChange={async (event) => { await service.extensions.importSkillMarkdown(event.currentTarget.files || []); event.currentTarget.value = ""; }} /><TextField id="skillZipInput" className="visually-hidden" type="file" accept=".zip,application/zip" ref={(element) => { zip = element; }} onChange={async (event) => { await service.extensions.importSkillPackage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></div>;
}

function ToolFields({ editing, service }: { editing: any; service: SettingsService }) {
  const draft = editing.draft;
  return <><div className="form-section" style={{ paddingTop: 0 }}><label className="field-label" htmlFor="ext-name">工具名称</label><TextField id="ext-name" className="field" data-extension-field="name" value={draft.name} placeholder="weather_lookup" maxLength={64} autoComplete="off" onChange={(event) => service.extensions.setField("name", event.currentTarget.value)} /><p className="field-help">以字母开头，可使用字母、数字、<code className="inline-code">_</code> 和 <code className="inline-code">-</code>。</p></div><div className="form-section"><label className="field-label" htmlFor="ext-description">用途说明</label><TextArea id="ext-description" className="field" rows={3} data-extension-field="description" value={draft.description} placeholder="查询某城市的实时天气" onChange={(event) => service.extensions.setField("description", event.currentTarget.value)} /></div><div className="form-section"><label className="field-label" htmlFor="ext-endpoint">HTTP Endpoint</label><TextField id="ext-endpoint" className="field" data-extension-field="endpoint" value={draft.endpoint} placeholder="https://tools.example.com/weather" inputMode="url" onChange={(event) => service.extensions.setField("endpoint", event.currentTarget.value)} /><p className="field-help">POST JSON；仅支持 HTTPS 或本机 HTTP。</p></div><div className="form-section"><label className="field-label" htmlFor="ext-schema">输入 Schema（JSON）</label><TextArea id="ext-schema" className="field extension-schema-field" rows={12} data-extension-schema spellCheck={false} value={editing.schemaText} onChange={(event) => service.extensions.setSchema(event.currentTarget.value)} /><p className="field-help">根节点必须是 <code className="inline-code">&#123; "type": "object" &#125;</code>，最多 16KB。</p></div></>;
}

function ExtensionForm({ state, service }: { state: SettingsState; service: SettingsService }) {
  const editing = state.extensionEditing!;
  return <div className="settings-pane"><h2 className="settings-pane-title">{editing.mode === "new" ? "新增" : "编辑"}工具</h2><section className="paper-panel settings-card extension-form-card"><h3 className="settings-card-title">工具配置</h3><ToolFields service={service} editing={editing} /><ToggleSetting label="全局启用" hint="仅保存启用状态，暂不执行。" checked={editing.draft.enabled} onClick={service.extensions.toggleDraftEnabled} /></section><footer className="context-savebar extension-savebar"><div aria-live="polite">{editing.saveError ? <p className="extension-save-error" role="alert">{editing.saveError}</p> : null}</div><div><Button type="button" className="btn btn-ghost" id="extensionCancelBtn" onClick={service.extensions.cancel}>取消</Button><Button type="button" className="btn btn-primary" id="extensionSaveBtn" onClick={service.extensions.save}>保存工具</Button></div></footer></div>;
}

export function ExtensionsPane({ store, state, service, kind }: { store: ExternalStore & { state: any }; state: SettingsState; service: SettingsService; kind: Kind }) {
  if (kind === "tool" && state.extensionEditing?.kind === "tool") return <ExtensionForm state={state} service={service} />;
  const registry = useStoreValue<any>(store, "extensions");
  const current = meta[kind];
  const entries = kind === "tool" ? registry.tools : registry.skills;
  const runtime = kind === "tool" ? [registry.sandbox, registry.codeInterpreter].filter(Boolean) : [];
  const enabled = entries.filter((entry: any) => entry.enabled).length + runtime.filter((entry: any) => entry.enabled).length;
  return <div className="settings-pane"><h2 className="settings-pane-title">{current.title}</h2><div className="settings-extension-grid is-single"><section className="paper-panel settings-card extension-management-card" data-extension-card={kind} data-extension-config={current.key} aria-labelledby={`extension-card-${kind}-title`}><div className="extension-card-head"><div className="extension-card-title-wrap"><span className="extension-card-mark"><TrustedIcon name={current.icon} size={17} /></span><div><h3 className="settings-card-title" id={`extension-card-${kind}-title`}>{current.card}</h3><p className="extension-card-count">已启用 {enabled} 项，共 {entries.length + runtime.length} 项</p></div></div>{kind === "skill" ? <SkillImport service={service} /> : <Button type="button" className="btn btn-secondary extension-add-btn" data-extension-new={kind} onClick={() => service.extensions.begin(kind)}><TrustedIcon name="plus" size={14} /> {current.action}</Button>}</div>{current.desc ? <p className="settings-card-desc">{current.desc}</p> : null}<CapabilityNote />{kind === "tool" ? <><RuntimeSetting checked={registry.sandbox?.enabled} service={service} /><RuntimeSetting interpreter checked={registry.codeInterpreter?.enabled} service={service} /></> : null}{entries.length ? <div className="extension-settings-list">{entries.map((entry: any) => <Item key={entry.id} kind={kind} entry={entry} service={service} />)}</div> : <div className="extension-empty-list"><TrustedIcon name={current.icon} size={15} /><span>{kind === "tool" ? "暂无工具。" : "暂无技能。"}</span></div>}</section></div></div>;
}
