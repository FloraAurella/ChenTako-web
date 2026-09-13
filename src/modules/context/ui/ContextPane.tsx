import { SettingsCard, SettingsGroup } from "../../../shared/ui/SettingsCard";
import { Button, TextField, SelectField } from "../../../shared/ui/primitives";
import { useEffect, useState } from "react";
import { useStoreValue, type ExternalStore } from "../../../shared/state/react";
import { normalizeChatConfig, modelCompatibility } from "../domain/config.js";
import { resolveInputBudget } from "../domain/budget.js";
import { resolveEffectiveModelConfig } from "../../connections/public/domain_models.js";
import { EFFORT_LEVELS } from "../../../contracts/constants.js";
import { useSettingsState } from "../../../shared/settings/shared";
import type { SettingsService } from "../../settings/public/services_settings-service";

export function ContextPane({ store, service, projectId = "" }: { store: ExternalStore & { state: any }; service: SettingsService; projectId?: string }) {
  const projects = useStoreValue<any[]>(store, "projects");
  const providers = useStoreValue<any[]>(store, "providers");
  useStoreValue(store, "chat-config");
  const state = useSettingsState(service);
  const editor = state.contextEditing;
  const [modelKey, setModelKey] = useState("");
  const project = projects.find((p) => p.id === projectId);
  useEffect(() => { service.context.begin(projectId); return () => service.context.releaseEditor(); }, [service, projectId]);
  if (!editor || editor.projectId !== (project?.id || "")) return null;
  const inherited = normalizeChatConfig(store.state.chatConfig) as Record<string, any>;
  const values: Record<string, any> = editor.projectId ? { ...inherited, ...editor.values } : editor.values;
  const isProject = Boolean(editor.projectId);
  const keys = Object.keys(editor.values).filter(key => key !== "systemPrompt");
  const models = providers.flatMap((p) => p.models.map((model: string) => ({ provider: p, model, key: JSON.stringify([p.id, model]) })));
  const selected = models.find((m) => m.key === modelKey) || models[0];
  const caps = selected ? modelCompatibility({ modelCompatibility: editor.compatibility }, selected.provider.id, selected.model) : {};
  const budgetModel = providers.find((p) => p.id === store.state.activeProviderId);
  let budgetText = "添加模型后可计算输入预算。";
  if (budgetModel?.defaultModel) {
    try { budgetText = `${budgetModel.defaultModel} 的可用输入预算：${resolveInputBudget(resolveEffectiveModelConfig(budgetModel, budgetModel.defaultModel), values).toLocaleString()} Tokens（估算）。`; }
    catch (error) { budgetText = error instanceof Error ? error.message : String(error); }
  }
  function field(key: string, label: string, hint: string, type = "number", range: { min?: number; max?: number; step?: number } = {}) {
    const overridden = Object.hasOwn(editor!.values, key);
    const disabled = isProject && !overridden;
    const id = `cc-${key}`;
    const control = type === "toggle" ? <TextField id={id} type="checkbox" role="switch" checked={Boolean(values[key])} disabled={disabled} onChange={(e) => service.context.setField(key, e.target.checked)} />
      : type === "model" ? <SelectField id={id} value={values[key] ? JSON.stringify([values[key].providerId, values[key].model]) : ""} disabled={disabled} onChange={(e) => { const pair = e.target.value ? JSON.parse(e.target.value) : null; service.context.setField(key, pair ? { providerId: pair[0], model: pair[1] } : null); }}>
        <option value="">与当前对话模型相同</option>
        {values[key] && !models.some(m => m.key === JSON.stringify([values[key].providerId, values[key].model])) ? <option value={JSON.stringify([values[key].providerId, values[key].model])}>不可用：{values[key].model}</option> : null}
        {models.map(m => <option key={m.key} value={m.key} disabled={m.provider.enabled === false}>{m.provider.displayName} / {m.model}{m.provider.enabled === false ? "（已禁用）" : ""}</option>)}
      </SelectField>
      : type === "effort" ? <select id={id} className="field" value={values[key]} disabled={disabled} onChange={(e) => service.context.setField(key, e.target.value)}>{EFFORT_LEVELS.map((level) => <option key={level.key} value={level.key}>{level.label}</option>)}</select>
      : <TextField id={id} className="field" type={type} {...range} value={values[key] ?? ""} placeholder="可选" maxLength={type === "text" ? 200 : undefined} disabled={disabled} onChange={(e) => service.context.setField(key, type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />;
    return <div className="config-field" key={key}>
      <div className="config-field-heading"><label htmlFor={id}>{label}</label>{isProject ? <Button type="button" className={`inherit-chip${overridden ? " is-custom" : ""}`} onClick={() => overridden ? service.context.inherit(key) : service.context.setField(key, inherited[key])}>{overridden ? "自定义 · 恢复继承" : "继承聊天 · 自定义"}</Button> : null}</div>
      {control}{hint ? <p className="field-help">{hint}</p> : null}
    </div>;
  }
  return <div className="settings-pane context-pane" onCompositionStart={() => service.context.setComposing(true)} onCompositionEnd={() => service.context.setComposing(false)} onBlur={() => void service.context.save()}>
    <h2 className="settings-pane-title">上下文与提示词</h2>
    <div className="context-auto-state" aria-live="polite">{editor.error ? <><p role="alert" className="provider-model-error">{editor.error}</p><Button type="button" className="btn btn-secondary compact" disabled={editor.saving} onClick={() => void service.context.save()}>重试</Button></> : <span>{editor.saving ? "保存中…" : editor.dirty ? "等待保存" : "已自动保存"}</span>}</div>
    <section className="config-scope" aria-label="配置作用范围"><div><span className="config-scope-label">当前作用范围</span><label className="visually-hidden" htmlFor="context-scope">选择配置范围</label><select id="context-scope" className="field" value={editor.projectId} onChange={(e) => { location.hash = `#/settings/context${e.target.value ? `/${encodeURIComponent(e.target.value)}` : ""}`; }}><option value="">聊天默认配置</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="config-scope-summary"><strong>{isProject ? `${keys.length} 项自定义` : "所有普通聊天"}</strong><span>{isProject ? "其余设置继承默认值" : "项目未自定义时跟随更新"}</span></div><Button type="button" className="btn btn-ghost compact" onClick={service.context.reset}>{isProject ? "全部恢复继承" : "恢复应用默认"}</Button></section>
    <SettingsGroup id="context-common" title="常用配置">
    <SettingsCard id="context-budget" title="上下文策略"><div className="config-grid">{field("compressionThreshold", "压缩触发阈值（%）", "响应正常结束时达到此比例，自动压缩已完成历史。", "number", { min: 10, max: 95 })}{field("compressionModel", "压缩模型", "用于自动与手动压缩，项目资料不会进入摘要请求。", "model")}{field("titleModel", "标题模型", "首次发送时根据输入生成标题，每个对话仅尝试一次。", "model")}</div><p className="config-budget-note">{budgetText} 预算自动扣除最大输出与 5% 安全余量，用量为估算。</p></SettingsCard>
    </SettingsGroup>
    <SettingsGroup id="context-advanced" title="高级配置">
    <SettingsCard id="context-generation" title="生成参数" description="以模型和 API 支持为准。"><div className="config-grid">{field("defaultReasoningEffort", "默认思考强度", "可在聊天中临时调整。", "effort")}{field("temperature", "Temperature", "随机性；部分推理模型不支持。", "number", { min: 0, max: 2, step: 0.1 })}{field("topP", "Top P", "采样范围；Gemini 思考模式不使用。", "number", { min: 0, max: 1, step: 0.05 })}</div></SettingsCard>
    <SettingsCard id="context-behavior" title="输出与会话"><div className="config-grid">{field("streaming", "流式输出", "边生成边显示。", "toggle")}{field("saveChats", "本地保存对话", "仅影响新会话。", "toggle")}{field("userId", "User ID", "可选；Gemini 不使用。", "text")}</div></SettingsCard>
    <SettingsCard id="context-compatibility" title="模型兼容性" description="手动修正图片能力，对所有项目生效。">{selected ? <><label className="field-label" htmlFor="compatibility-model">选择模型</label><select id="compatibility-model" className="field" value={selected.key} onChange={(e) => setModelKey(e.target.value)}>{models.map((m) => <option key={m.key} value={m.key}>{m.provider.displayName} / {m.model}</option>)}</select><div className="config-grid">{([['visionInput', '图片输入能力'], ['imageOutput', '图片输出能力']] as const).map(([key, label]) => <div className="config-field" key={key}><label htmlFor={`cc-${key}`}>{label}</label><select id={`cc-${key}`} className="field" value={String(caps[key] ?? "auto")} onChange={(e) => service.context.setCapability(selected.provider.id, selected.model, key, e.target.value === "auto" ? "auto" : e.target.value === "true")}><option value="auto">自动识别</option><option value="true">支持</option><option value="false">关闭</option></select></div>)}</div></> : <p className="field-help">请先添加模型。</p>}</SettingsCard>
    </SettingsGroup>

  </div>;
}
