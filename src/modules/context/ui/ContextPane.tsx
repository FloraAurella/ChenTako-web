import { SettingsCard } from "../../../shared/ui/SettingsCard";
import { Button, TextField, TextArea } from "../../../shared/ui/primitives";
import { useEffect, useState, type ReactNode } from "react";
import { useStoreValue, type ExternalStore } from "../../../shared/state/react";
import { CHAT_CONFIG_DEFAULTS, normalizeChatConfig, modelCompatibility } from "../domain/config.js";
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
  const [expanded, setExpanded] = useState(false);
  const [modelKey, setModelKey] = useState("");
  const project = projects.find((p) => p.id === projectId);
  useEffect(() => { service.context.begin(projectId); }, [service, projectId]);
  if (!editor || editor.projectId !== (project?.id || "")) return null;
  const inherited = normalizeChatConfig(store.state.chatConfig) as Record<string, any>;
  const values: Record<string, any> = editor.projectId ? { ...inherited, ...editor.values } : editor.values;
  const isProject = Boolean(editor.projectId);
  const keys = Object.keys(editor.values);
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
    const disabled = editor!.saving || (isProject && !overridden);
    const id = `cc-${key}`;
    const control = type === "toggle" ? <TextField id={id} type="checkbox" role="switch" checked={Boolean(values[key])} disabled={disabled} onChange={(e) => service.context.setField(key, e.target.checked)} />
      : type === "effort" ? <select id={id} className="field" value={values[key]} disabled={disabled} onChange={(e) => service.context.setField(key, e.target.value)}>{EFFORT_LEVELS.map((level) => <option key={level.key} value={level.key}>{level.label}</option>)}</select>
      : type === "textarea" ? <TextArea id={id} className={`field prompt-editor${expanded ? " is-expanded" : ""}`} rows={expanded ? 20 : 7} value={values[key]} maxLength={102400} disabled={disabled} placeholder="描述助手的角色、回答方式和需要遵守的要求…" onChange={(e) => service.context.setField(key, e.target.value)} />
      : <TextField id={id} className="field" type={type} {...range} value={values[key] ?? ""} placeholder={key === "inputBudget" ? "自动计算" : "可选"} maxLength={type === "text" ? 200 : undefined} disabled={disabled} onChange={(e) => service.context.setField(key, type === "number" ? (e.target.value === "" && key === "inputBudget" ? null : e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />;
    return <div className={`config-field${type === "textarea" ? " config-field-wide" : ""}`} key={key}>
      <div className="config-field-heading"><label htmlFor={id}>{label}</label>{isProject ? <Button type="button" className={`inherit-chip${overridden ? " is-custom" : ""}`} disabled={editor!.saving} onClick={() => overridden ? service.context.inherit(key) : service.context.setField(key, inherited[key])}>{overridden ? "自定义 · 恢复继承" : "继承聊天 · 自定义"}</Button> : null}</div>
      {control}<p className="field-help">{hint}</p>
      {type === "textarea" ? <div className="prompt-tools"><span>{String(values[key]).length.toLocaleString()} / 102,400 字符</span><Button type="button" className="btn btn-ghost compact" onClick={() => setExpanded(!expanded)}>{expanded ? "收起编辑器" : "展开编辑器"}</Button><Button type="button" className="btn btn-ghost compact" disabled={disabled} onClick={() => service.context.setField(key, CHAT_CONFIG_DEFAULTS.systemPrompt)}>清空提示词</Button></div> : null}
    </div>;
  }
  return <div className="settings-pane context-pane">
    <h2 className="settings-pane-title">上下文与提示词</h2><p className="settings-pane-lede">统一设置聊天行为，让每个项目保留需要的差异。</p>
    <section className="config-scope" aria-label="配置作用范围"><div><span className="config-scope-label">当前作用范围</span><label className="visually-hidden" htmlFor="context-scope">选择配置范围</label><select id="context-scope" className="field" disabled={editor.saving} value={editor.projectId} onChange={(e) => { location.hash = `#/settings/context${e.target.value ? `/${encodeURIComponent(e.target.value)}` : ""}`; }}><option value="">聊天默认配置</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="config-scope-summary"><strong>{isProject ? `${keys.length} 项自定义` : "所有普通聊天"}</strong><span>{isProject ? "其余项目设置持续继承聊天默认值" : "项目未覆盖的设置也会跟随更新"}</span></div><Button type="button" className="btn btn-ghost compact" disabled={editor.saving} onClick={service.context.reset}>{isProject ? "全部恢复继承" : "恢复应用默认"}</Button></section>
    <SettingsCard id="context-prompt" title="系统提示词" description={isProject ? "项目提示词整体覆盖聊天提示词；自定义为空表示不使用提示词。" : "从下一次发送起生效，切换模型时保留。"}>{field("systemPrompt", "提示词内容", "技能和必要的工具运行指令由应用单独添加。", "textarea")}</SettingsCard>
    <SettingsCard id="context-budget" title="上下文策略" description="控制发送多少上下文，保留模型窗口与输出额度的安全余量。"><div className="config-grid">{field("inputBudget", "输入预算（Tokens）", "留空自动计算：模型窗口 − 最大输出 − 5% 窗口安全余量。", "number", { min: 1, max: 10000000 })}{field("autoCompress", "自动压缩历史", "达到阈值时压缩已完成的历史，不按固定轮数保留；会产生额外模型请求，聊天记录不会删除。", "toggle")}{field("compressionThreshold", "压缩触发阈值（%）", "占用达到输入预算的此比例时，在发送前压缩一次。", "number", { min: 10, max: 95 })}</div><p className="config-budget-note">{budgetText} 实际发送使用当前会话模型；附件与工具内容采用保守估算。</p></SettingsCard>
    <SettingsCard id="context-generation" title="生成参数" description="实际适用参数由模型与 API 协议决定。"><div className="config-grid">{field("defaultReasoningEffort", "默认思考强度", "聊天工具栏可临时覆盖，也可恢复跟随配置。", "effort")}{field("temperature", "Temperature", "控制采样随机性；部分推理模型不接受此参数。", "number", { min: 0, max: 2, step: 0.1 })}{field("topP", "Top P", "控制采样候选范围；Gemini 思考模式不发送采样参数。", "number", { min: 0, max: 1, step: 0.05 })}</div></SettingsCard>
    <SettingsCard id="context-behavior" title="输出与会话"><div className="config-grid">{field("streaming", "流式输出", "边生成边显示；关闭后等待完整响应。", "toggle")}{field("saveChats", "本地保存对话", "用于新建会话；已有会话保留原保存状态。", "toggle")}{field("userId", "User ID", "可选；Gemini 不发送此字段，其他协议按各自格式传递。", "text")}</div></SettingsCard>
    <SettingsCard id="context-compatibility" title="模型兼容性" description="全局配置，不参与项目继承。用于纠正模型图片能力的自动识别。">{selected ? <><label className="field-label" htmlFor="compatibility-model">选择模型</label><select id="compatibility-model" className="field" value={selected.key} disabled={editor.saving} onChange={(e) => setModelKey(e.target.value)}>{models.map((m) => <option key={m.key} value={m.key}>{m.provider.displayName} / {m.model}</option>)}</select><div className="config-grid">{([['visionInput', '图片输入能力'], ['imageOutput', '图片输出能力']] as const).map(([key, label]) => <div className="config-field" key={key}><label htmlFor={`cc-${key}`}>{label}</label><select id={`cc-${key}`} className="field" disabled={editor.saving} value={String(caps[key] ?? "auto")} onChange={(e) => service.context.setCapability(selected.provider.id, selected.model, key, e.target.value === "auto" ? "auto" : e.target.value === "true")}><option value="auto">自动识别</option><option value="true">支持</option><option value="false">关闭</option></select></div>)}</div></> : <p className="field-help">请先在“模型与供应商”中添加模型。</p>}</SettingsCard>
    <footer className="context-savebar"><div aria-live="polite">{editor.error ? <p role="alert" className="provider-model-error">{editor.error}</p> : <span>{editor.saving ? "正在保存…" : editor.dirty ? "有未保存的修改" : "配置已保存"}</span>}</div><div><Button type="button" className="btn btn-ghost" disabled={!editor.dirty || editor.saving} onClick={() => service.context.begin(projectId)}>放弃更改</Button><Button type="button" className="btn btn-primary" disabled={!editor.dirty || editor.saving} onClick={() => void service.context.save()}>保存更改</Button></div></footer>
  </div>;
}
