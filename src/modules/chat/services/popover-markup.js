import { EFFORT_LEVELS, effortLevelOf } from "../../../contracts/constants.js";
import { icon } from "../../../resources/icons/index.js";
import { formatTokenCount } from "../../../shared/utils.js";

function escape(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function attr(value) { return escape(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }

// ---------- 模型面板（运行配置二级） ----------

export function modelProviderGroupsHtml(providers, conversation) {
  const enabledProviders = providers.filter((provider) => provider.enabled !== false);
  return enabledProviders.length ? enabledProviders.map((provider) => {
    const models = provider.models.length ? provider.models.map((model) => `<button type="button" class="option-item${conversation.providerId === provider.id && conversation.model === model ? " is-selected" : ""}" aria-pressed="${conversation.providerId === provider.id && conversation.model === model}" data-provider-id="${attr(provider.id)}" data-model="${attr(model)}"><div class="option-main"><div class="option-title">${escape(model)}</div></div><span class="option-check">${icon("check", 15)}</span></button>`).join("") : `<div class="empty-list-note">暂无模型，去设置添加</div>`;
    return `<div class="group-label"><span>${escape(provider.displayName)}</span>${provider.hasKeyConfigured ? "" : `<span class="option-hint">未配 Key</span>`}</div>${models}`;
  }).join("") : `<div class="empty-list-note">请先在设置中添加供应商。</div><div style="padding: 0 11px 11px;"><button type="button" class="btn btn-primary" style="width:100%" data-goto-settings>前往设置</button></div>`;
}

/** 运行配置二级「模型」面板：无标题行，直接供应商分组列表。 */
export function modelPanelMarkup(providers, conversation) {
  return `<div class="popover-scroll">${modelProviderGroupsHtml(providers, conversation)}</div>`;
}

// ---------- 思考强度面板 ----------
export function effortPanelMarkup(level, model = "", resetLevel = "high") {
  const current = effortLevelOf(level);
  const index = EFFORT_LEVELS.findIndex((item) => item.key === current.key);
  const resetLabel = effortLevelOf(resetLevel).label;
  const dots = EFFORT_LEVELS.map((_, dotIndex) => `<i data-dot="${dotIndex}"${dotIndex <= index ? ' class="is-past"' : ""}></i>`).join("");
  const particles = '<span class="effort-particle" aria-hidden="true"></span>'.repeat(9);
  return `<div class="effort-head"><span class="effort-head-spacer" aria-hidden="true"></span><div class="effort-heading"><span class="effort-current" data-effort-current>${escape(current.label)}</span><span class="effort-model" tabindex="0" title="${attr(model)}">${escape(model)}</span></div><button type="button" class="effort-reset" data-effort-reset title="重置为：${attr(resetLabel)}" aria-label="重置为：${attr(resetLabel)}">${icon("refresh", 18)}</button></div><div class="effort-rail" role="slider" tabindex="0" aria-label="思考强度" aria-valuemin="0" aria-valuemax="${EFFORT_LEVELS.length - 1}" aria-valuenow="${index}" aria-valuetext="${attr(current.label)}"><div class="effort-rail-track" aria-hidden="true"></div><div class="effort-rail-fill" aria-hidden="true"><div class="effort-particles">${particles}</div></div><div class="effort-rail-dots" aria-hidden="true">${dots}</div><div class="effort-rail-thumb" aria-hidden="true"></div></div>`;
}

// ---------- 运行配置根面板（目录） ----------

export function runtimeRootPanelMarkup(modelValue, effortLabel) {
  return `<div class="runtime-root"><button type="button" class="runtime-row" data-runtime-open="model"><span class="option-main"><span class="option-title">模型</span></span><span class="runtime-row-value" data-runtime-model-value title="${attr(modelValue || "未选择")}">${escape(modelValue || "未选择")}</span><span class="runtime-row-chevron">${icon("chevronRight", 15)}</span></button><button type="button" class="runtime-row" data-runtime-open="effort"><span class="option-main"><span class="option-title">思考强度</span></span><span class="runtime-row-value is-accent" data-runtime-effort-value>${escape(effortLabel)}</span><span class="runtime-row-chevron">${icon("chevronRight", 15)}</span></button></div>`;
}

// ---------- 上下文 tooltip 与展开面板 ----------

export function contextTooltipLinesMarkup(usage) {
  const percent = Math.round(usage.percent * 100);
  const used = formatTokenCount(usage.used);
  const win = formatTokenCount(usage.window);
  const breakdown = usage.breakdown ? [
    ['指令 / 系统提示词', usage.breakdown.system], ['固定项目资料', usage.breakdown.fixed],
    ['历史与摘要', usage.breakdown.history], ['本次输入与附件', usage.breakdown.draft],
    ['扩展定义', usage.breakdown.extensions], ['输出预留（预算外）', usage.breakdown.reserved]
  ].map(([label, value]) => `<span class="context-tooltip-line">${label}：约 ${formatTokenCount(value)}</span>`).join('') : '';
  const error = usage.contextErrors?.length ? '<span class="context-tooltip-line">项目资料不完整，请检查知识库</span>' : '';
  return `<span class="context-tooltip-title" data-tooltip-title>上下文用量</span><span class="context-tooltip-line is-primary" data-tooltip-percent>${percent}% 已用</span><span class="context-tooltip-line" data-tooltip-window>已用 ${used} Tokens，预算 ${win}</span>${breakdown}${error}<span class="context-tooltip-hint" data-tooltip-hint>估算含请求开销 · 点击请求模型压缩历史</span>`;
}

// @deprecated — 二级额度弹层已移除（点击改为一键压缩），保留导出以兼容历史引用
export function usagePopoverMarkup() {
  return "";
}
