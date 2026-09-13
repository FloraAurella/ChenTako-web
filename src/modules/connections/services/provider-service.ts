import { modelCompatibility } from "../../context/public/domain_config.js";
import { apiFetch } from "../../../shared/api.js";
import { PROVIDER_PRESETS } from "../../../contracts/constants.js";
import { createId, normalizeProvider } from "../../../contracts/normalize.js";
import { resolveEffectiveModelConfig } from "../domain/models.js";
import { providerKeyVault } from "./provider-key-vault";
import type {
  ModelParameterKey,
  ProviderEditingState,
  ProviderModelEditingState,
  SettingsDependencies,
  SettingsStateBridge
} from "../../../contracts/settings";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const API_KEY_SYNC_DEBOUNCE_MS = 320;
const MODEL_PARAMETER_KEYS: ModelParameterKey[] = [
  "contextWindow", "maxTokens"
];

const BLANK_TEMPLATES: Record<string, Record<string, unknown>> = {
  "blank-responses": { responseFormat: "responses", displayName: "OpenAI Responses" },
  "blank-openai-compatible": { responseFormat: "openai-compatible", displayName: "OpenAI Compatible" },
  "blank-anthropic": { responseFormat: "anthropic", displayName: "Anthropic", baseUrl: "https://api.anthropic.com/v1" },
  "blank-google": { responseFormat: "google", displayName: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta" }
};

function sameDraft(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function validateApiKeyValue(value: string): string {
  if (value.length > 512) return "API Key 过长（最多 512 字符）";
  if (/[\r\n]/.test(value)) return "API Key 不能包含换行";
  return "";
}

function draftFromTemplate(templateId: string): any {
  const preset = PROVIDER_PRESETS.find((item: any) => item.id === templateId);
  const template = preset || BLANK_TEMPLATES[templateId] || {};
  const blank = {
    id: createId(),
    displayName: "",
    baseUrl: "",
    responseFormat: "openai-compatible",
    models: [],
    enabled: true,
    streaming: true,
    saveChats: true
  };
  return normalizeProvider({
    ...blank,
    ...clone(template),
    ...(preset ? { displayName: preset.displayName } : {})
  });
}

function modelEditor(provider: any, modelId: string, mode: ProviderModelEditingState["mode"]): ProviderModelEditingState {
  const effective = resolveEffectiveModelConfig(provider, modelId);
  const override = provider.modelOverrides?.[modelId] || {};
  const isDefaults = mode === "defaults";
  return {
    mode,
    originalId: modelId,
    error: "",
    draft: {
      id: modelId,
      isDefault: provider.defaultModel === modelId,
      contextWindow: String(isDefaults ? provider.contextWindow : effective.contextWindow),
      maxTokens: String(isDefaults ? provider.maxTokens : effective.maxTokens),
      inherit: Object.fromEntries(MODEL_PARAMETER_KEYS.map((key) => [
        key,
        isDefaults ? false : !Object.prototype.hasOwnProperty.call(override, key)
      ])) as Record<ModelParameterKey, boolean>
    }
  };
}

export function createProviderSettingsService(
  dependencies: SettingsDependencies,
  stateBridge: SettingsStateBridge
) {
  const { store, dialogs, toast } = dependencies;
  let apiKeySyncTimer: ReturnType<typeof setTimeout> | null = null;
  let apiKeySyncQueue: Promise<void> = Promise.resolve();
  let apiKeySyncRevision = 0;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let saveRunning: Promise<boolean> | null = null;
  let saveController: AbortController | null = null;
  let editorSession = 0;
  let composing = false;
  const attemptedRegistrations = new Set<string>();

  function cancelSaveTimer() { if (saveTimer) clearTimeout(saveTimer); saveTimer = null; }
  function scheduleSave(immediate = false) {
    cancelSaveTimer();
    if (composing) return;
    if (immediate) { void save(); return; }
    saveTimer = setTimeout(() => { saveTimer = null; void save(); }, 320);
  }
  function setComposing(value: boolean) { composing = value; if (value) cancelSaveTimer(); else scheduleSave(); }
  function releaseEditor() {
    composing = false;
    cancelSaveTimer(); cancelScheduledApiKeySync();
    editorSession += 1;
    saveController?.abort();
  }


  function editing(): ProviderEditingState | null {
    return stateBridge.get().providerEditing;
  }

  function update(mutator: (next: ProviderEditingState) => void, { preserveDirty = false } = {}): void {
    const current = editing();
    if (!current) return;
    const next: ProviderEditingState = clone(current);
    mutator(next);
    if (!preserveDirty) { next.dirty = !sameDraft(next.draft, next.originalDraft); next.saveError = ""; }
    stateBridge.patch({ providerEditing: next });
  }

  function cancelScheduledApiKeySync(): void {
    if (apiKeySyncTimer) {
      clearTimeout(apiKeySyncTimer);
      apiKeySyncTimer = null;
    }
    apiKeySyncRevision += 1;
  }

  function setLocalProviderKeyState(providerId: string, hasKeyConfigured: boolean): void {
    const providers = [...store.state.providers];
    const index = providers.findIndex((item: any) => item.id === providerId);
    if (index < 0 || providers[index].hasKeyConfigured === hasKeyConfigured) return;
    providers[index] = { ...providers[index], hasKeyConfigured };
    store.actions.setProviders(providers);
  }

  async function hydrateApiKey(providerId: string, reveal = false): Promise<void> {
    const initial = editing();
    if (!initial || initial.mode === "new" || initial.draft.id !== providerId || !initial.draft.hasKeyConfigured || initial.apiKeyLoading) return;
    update((next) => { next.apiKeyLoading = true; }, { preserveDirty: true });
    try {
      let apiKey = "";
      try { apiKey = await providerKeyVault.load(providerId); } catch { /* 后端读取兜底 */ }
      if (!apiKey) {
        const response = await apiFetch(`/api/providers/key?id=${encodeURIComponent(providerId)}`, { method: "GET", cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.apiKey) {
          if (response.status === 404) {
            update((next) => {
              next.apiKeyLoading = false;
              next.draft.hasKeyConfigured = false;
              next.originalDraft.hasKeyConfigured = false;
            }, { preserveDirty: true });
            setLocalProviderKeyState(providerId, false);
            return;
          }
          throw new Error(payload.error || `HTTP ${response.status}`);
        }
        apiKey = String(payload.apiKey);
        try { await providerKeyVault.save(providerId, apiKey); } catch {
          toast("Key 已读取，但当前环境无法保存前端加密副本", { tone: "danger" });
        }
      }
      if (editing()?.draft.id !== providerId) return;
      update((next) => {
        next.apiKeyLoading = false;
        if (next.apiKeyDirty) return;
        next.apiKey = apiKey;
        next.apiKeyVisible = reveal;
      }, { preserveDirty: true });
    } catch (error) {
      if (editing()?.draft.id === providerId) {
        update((next) => { next.apiKeyLoading = false; }, { preserveDirty: true });
        toast(`无法读取已保存的 Key：${error instanceof Error ? error.message : String(error)}`, { tone: "danger" });
      }
    }
  }

  async function syncApiKey(providerId: string, revision: number): Promise<void> {
    if (revision !== apiKeySyncRevision) return;
    const current = editing();
    if (!current || current.mode !== "edit" || current.draft.id !== providerId || !current.apiKeyDirty) return;
    const rawValue = current.apiKey;
    const validationError = validateApiKeyValue(rawValue);
    if (validationError) {
      update((next) => { next.apiKeySyncing = false; }, { preserveDirty: true });
      toast(validationError, { tone: "danger" });
      return;
    }
    const apiKey = rawValue.trim();
    update((next) => { next.apiKeySyncing = true; }, { preserveDirty: true });
    try {
      const response = apiKey
        ? await apiFetch("/api/providers/key", { method: "PUT", body: JSON.stringify({ id: providerId, displayName: current.draft.displayName, apiKey }) })
        : await apiFetch("/api/providers/key", { method: "DELETE", body: JSON.stringify({ id: providerId, displayName: current.draft.displayName }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      const latest = editing();
      if (!latest || latest.draft.id !== providerId || latest.apiKey !== rawValue) return;
      update((next) => {
        next.apiKeySyncing = false;
        next.apiKeyDirty = false;
        next.draft.hasKeyConfigured = Boolean(apiKey);
        next.originalDraft.hasKeyConfigured = Boolean(apiKey);
      }, { preserveDirty: true });
      setLocalProviderKeyState(providerId, Boolean(apiKey));
      try {
        if (apiKey) await providerKeyVault.save(providerId, apiKey);
        else await providerKeyVault.remove(providerId);
      } catch { toast("后端已同步，但前端加密副本更新失败", { tone: "danger" }); }
    } catch (error) {
      if (editing()?.draft.id === providerId && editing()?.apiKey === rawValue) {
        update((next) => { next.apiKeySyncing = false; }, { preserveDirty: true });
        toast(`Key 自动同步失败：${error instanceof Error ? error.message : String(error)}`, { tone: "danger" });
      }
    }
  }

  function scheduleApiKeySync(providerId: string): void {
    if (apiKeySyncTimer) clearTimeout(apiKeySyncTimer);
    const revision = ++apiKeySyncRevision;
    apiKeySyncTimer = setTimeout(() => {
      apiKeySyncTimer = null;
      apiKeySyncQueue = apiKeySyncQueue.then(() => syncApiKey(providerId, revision)).catch(() => {});
    }, API_KEY_SYNC_DEBOUNCE_MS);
  }

  async function flushPendingApiKeySync(): Promise<boolean> {
    const current = editing();
    if (!current || current.mode !== "edit" || !current.apiKeyDirty) return true;
    if (apiKeySyncTimer) {
      clearTimeout(apiKeySyncTimer);
      apiKeySyncTimer = null;
    }
    const revision = apiKeySyncRevision;
    const providerId = current.draft.id;
    apiKeySyncQueue = apiKeySyncQueue.then(() => syncApiKey(providerId, revision)).catch(() => {});
    await apiKeySyncQueue;
    const latest = editing();
    return !latest || latest.mode !== "edit" || latest.draft.id !== providerId || !latest.apiKeyDirty;
  }

  function startEditing(mode: "new" | "edit", draft: any): void {
    cancelSaveTimer();
    editorSession += 1;
    cancelScheduledApiKeySync();
    const normalized = normalizeProvider(clone(draft));
    stateBridge.patch({
      providerEditing: {
        mode,
        draft: normalized,
        originalDraft: clone(normalized),
        dirty: false,
        modelAliases: {},
        apiKey: "",
        apiKeyVisible: false,
        apiKeyLoading: false,
        apiKeySyncing: false,
        apiKeyDirty: false,
        testing: false,
        testResult: "",
        testResultTone: "",
            modelEditing: null
      }
    });
  }

  function beginNew(templateId = "blank-openai-compatible"): void {
    startEditing("new", draftFromTemplate(templateId));
    if (!validateProvider()) scheduleSave(true);
  }

  function beginEdit(providerId: string): void {
    const current = editing();
    if (current?.mode === "edit" && current.draft.id === providerId) return;
    const provider = store.state.providers.find((entry: any) => entry.id === providerId);
    if (!provider) return;
    startEditing("edit", provider);
    if (provider.hasKeyConfigured) void hydrateApiKey(provider.id);
  }

  async function settleBeforeLeave(): Promise<boolean> {
    if (!(await save())) return false;
    if (!editing()?.modelEditing) return true;
    return dialogs.confirm({ title: "模型参数尚未保存", message: "离开会放弃弹窗内尚未保存的模型参数。", confirmLabel: "放弃修改" });
  }

  async function select(providerId: string): Promise<boolean> {
    const current = editing();
    if (current?.mode === "edit" && current.draft.id === providerId) return true;
    if (!(await settleBeforeLeave())) return false;
    if (!(await flushPendingApiKeySync())) return false;
    beginEdit(providerId);
    return true;
  }

  async function beforeNavigate(target: any): Promise<boolean> {
    const current = editing();
    if (!current) return true;
    const sameProvider = target?.name === "settings" && target?.settingsSection === "providers" && (
      (current.mode === "new" && target.settingsProviderId === "new") ||
      (current.mode === "edit" && target.settingsProviderId === current.draft.id)
    );
    if (sameProvider) return true;
    if (!(await settleBeforeLeave())) return false;
    // 编辑态由路由提交后的 resetNavigationState 统一清理。若在这里提前清空，
    // 旧路由仍挂载的 ProviderPane effect 会在 hash 更新前把旧供应商重新打开。
    // API Key 是独立的自动同步事务，普通导航也不应取消它。
    return flushPendingApiKeySync();
  }

  async function discard(): Promise<void> {
    let current = editing();
    if (!current) return;
    if (current.mode === "new") {
      stateBridge.patch({ providerEditing: null });
      return;
    }
    if (!(await flushPendingApiKeySync())) return;
    current = editing();
    if (!current) return;
    const provider = store.state.providers.find((entry: any) => entry.id === current.draft.id);
    if (!provider) return;
    const keyState = {
      apiKey: current.apiKey,
      apiKeyVisible: current.apiKeyVisible,
      apiKeyLoading: current.apiKeyLoading,
      apiKeySyncing: current.apiKeySyncing,
      apiKeyDirty: current.apiKeyDirty
    };
    startEditing("edit", provider);
    update((next) => Object.assign(next, keyState), { preserveDirty: true });
  }

  function setField(key: string, value: string | number): void {
    let providerId = "";
    update((next) => {
      if (key === "apiKey") {
        next.apiKey = String(value);
        next.apiKeyDirty = true;
        if (next.mode === "edit") providerId = next.draft.id;
        return;
      }
      next.draft[key] = value;
    }, { preserveDirty: key === "apiKey" });
    if (providerId) scheduleApiKeySync(providerId);
    else scheduleSave(key === "responseFormat");
  }

  function toggleFlag(key: "enabled"): void {
    update((next) => { next.draft[key] = !next.draft[key]; });
    scheduleSave(true);
  }

  async function toggleKeyVisibility(): Promise<void> {
    const current = editing();
    if (!current || current.apiKeyLoading) return;
    if (current.apiKeyVisible || current.apiKey || !current.draft.hasKeyConfigured || current.mode === "new") {
      update((next) => { next.apiKeyVisible = !next.apiKeyVisible; }, { preserveDirty: true });
      return;
    }
    await hydrateApiKey(current.draft.id, true);
  }

  function openModel(modelId: string): void {
    const current = editing();
    if (!current || !current.draft.models.includes(modelId)) return;
    update((next) => { next.modelEditing = modelEditor(next.draft, modelId, "edit"); }, { preserveDirty: true });
  }

  function openNewModel(): void {
    const current = editing();
    if (!current) return;
    update((next) => { next.modelEditing = modelEditor(next.draft, "", "new"); }, { preserveDirty: true });
  }

  function openModelDefaults(): void {
    const current = editing();
    if (!current) return;
    update((next) => { next.modelEditing = modelEditor(next.draft, "", "defaults"); }, { preserveDirty: true });
  }

  function closeModel(): void {
    update((next) => { next.modelEditing = null; }, { preserveDirty: true });
  }

  function setModelField(key: string, value: string | boolean): void {
    update((next) => {
      if (!next.modelEditing) return;
      (next.modelEditing.draft as any)[key] = value;
      next.modelEditing.error = "";
    }, { preserveDirty: true });
  }

  function toggleModelInheritance(key: ModelParameterKey): void {
    update((next) => {
      if (!next.modelEditing || next.modelEditing.mode === "defaults") return;
      next.modelEditing.draft.inherit[key] = !next.modelEditing.draft.inherit[key];
    }, { preserveDirty: true });
  }

  function validateModel(editor: ProviderModelEditingState, provider: any): string {
    const draft = editor.draft;
    if (editor.mode !== "defaults") {
      const id = draft.id.trim();
      if (!id) return "模型 ID 必填";
      if (id.length > 200) return "模型 ID 过长（最多 200 字符）";
      if (id !== editor.originalId && provider.models.includes(id)) return "模型 ID 已存在";
    }
    const contextWindow = Number(draft.contextWindow);
    const maxTokens = Number(draft.maxTokens);

    if (!Number.isInteger(contextWindow) || contextWindow < 1 || contextWindow > 10000000) return "上下文窗口必须是 1–10000000 的整数";
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 1000000) return "最大输出 Token 必须是 1–1000000 的整数";
    const effectiveWindow = editor.mode !== "defaults" && draft.inherit.contextWindow ? provider.contextWindow : contextWindow;
    const effectiveOutput = editor.mode !== "defaults" && draft.inherit.maxTokens ? provider.maxTokens : maxTokens;
    if (effectiveOutput >= Math.floor(effectiveWindow * 0.95)) return "最大输出与 5% 安全余量已占满上下文窗口，请调整模型额度";
    return "";
  }

  async function applyModel(): Promise<boolean> {
    const current = editing();
    const editor = current?.modelEditing;
    if (!current || !editor || current.saving) return false;
    const error = validateModel(editor, current.draft);
    if (error) {
      update((next) => { if (next.modelEditing) next.modelEditing.error = error; }, { preserveDirty: true });
      return false;
    }
    const submittedEditor = clone(editor);
    update((next) => {
      const active = next.modelEditing!;
      const modelDraft = active.draft;
      if (active.mode === "defaults") {
        next.draft.contextWindow = Number(modelDraft.contextWindow);
        next.draft.maxTokens = Number(modelDraft.maxTokens);
        return;
      }
      const modelId = modelDraft.id.trim();
      if (modelDraft.isDefault) next.draft.defaultModel = modelId;
      const oldId = active.originalId;
      const oldOverride = next.draft.modelOverrides[oldId];
      const oldCapabilities = next.draft.modelCapabilities[oldId];
      if (active.mode === "new") {
        next.draft.models = [...next.draft.models, modelId];
        if (!next.draft.defaultModel) next.draft.defaultModel = modelId;
      } else if (modelId !== oldId) {
        next.modelAliases[modelId] = next.modelAliases[oldId] || oldId;
        delete next.modelAliases[oldId];
        next.draft.models = next.draft.models.map((id: string) => id === oldId ? modelId : id);
        if (next.draft.defaultModel === oldId) next.draft.defaultModel = modelId;
        delete next.draft.modelOverrides[oldId];
        delete next.draft.modelCapabilities[oldId];
        if (oldOverride) next.draft.modelOverrides[modelId] = oldOverride;
        if (oldCapabilities) next.draft.modelCapabilities[modelId] = oldCapabilities;
      }
      const override: Record<string, unknown> = {};
      if (!modelDraft.inherit.contextWindow) override.contextWindow = Number(modelDraft.contextWindow);
      if (!modelDraft.inherit.maxTokens) override.maxTokens = Number(modelDraft.maxTokens);
      if (Object.keys(override).length) next.draft.modelOverrides[modelId] = override;
      else delete next.draft.modelOverrides[modelId];
    });
    const saved = await save();
    if (!saved && editing()?.draft.id === current.draft.id) {
      update(next => { next.draft = clone(current.draft); next.modelAliases = clone(current.modelAliases); next.modelEditing = { ...submittedEditor, error: next.saveError || "保存失败，请重试" }; }, { preserveDirty: true });
    }
    if (saved) closeModel();
    return saved;
  }

  async function removeModel(model: string): Promise<boolean> {
    const current = editing();
    if (!current || !current.draft.models.includes(model)) return false;
    const isDefault = current.draft.defaultModel === model;
    const confirmed = await dialogs.confirm({
      title: "删除模型",
      message: isDefault
        ? `「${model}」是默认模型。删除后将自动选择列表中的下一个模型；历史会话不会被改写。`
        : `删除「${model}」的配置？历史会话不会被改写。`,
      confirmLabel: "删除",
      danger: true
    });
    if (!confirmed || editing()?.draft.id !== current.draft.id) return false;
    update((next) => {
      next.draft.models = next.draft.models.filter((item: string) => item !== model);
      delete next.draft.modelCapabilities[model];
      delete next.draft.modelOverrides[model];
      if (next.draft.defaultModel === model) next.draft.defaultModel = next.draft.models[0] || "";
      next.modelEditing = null;
    });
    return save();
  }

  function setDefaultModel(model: string): void {
    update((next) => { if (next.draft.models.includes(model)) next.draft.defaultModel = model; });
    scheduleSave(true);
  }

  function validateProvider(): string {
    const current = editing();
    if (!current) return "没有正在编辑的供应商";
    if (!current.draft.displayName.trim()) return "显示名称必填";
    try {
      const url = new URL(current.draft.baseUrl.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    } catch { return "Base URL 必须是有效的 http/https 地址"; }
    return validateApiKeyValue(current.apiKey);
  }

  async function testConnection({ fetchModels = false }: { fetchModels?: boolean } = {}): Promise<void> {
    const validationError = validateProvider();
    if (validationError) {
      update((next) => { next.testResult = validationError; next.testResultTone = "error"; }, { preserveDirty: true });
      return;
    }
    const current = editing();
    if (!current || current.testing) return;
    const session = editorSession;
    update((next) => { next.testing = true; next.testResult = ""; next.testResultTone = ""; }, { preserveDirty: true });
    try {
      const response = await apiFetch("/api/providers/test", {
        method: "POST",
        body: JSON.stringify({
          id: current.mode === "edit" ? current.draft.id : "",
          displayName: current.draft.displayName,
          baseUrl: current.draft.baseUrl,
          responseFormat: current.draft.responseFormat,
          apiKey: current.apiKey
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      if (editorSession !== session || !editing()) return;
      if (!sameDraft(editing()!.draft, current.draft)) {
        update(next => { next.testing = false; next.testResult = "配置已变化，请重新读取模型"; }, { preserveDirty: true }); return;
      }
      if (fetchModels && Array.isArray(payload.models) && payload.models.length) {
        const models = [...new Set<string>((payload.models as unknown[]).map(String))].sort((a, b) => a.localeCompare(b));
        update((next) => {
          next.testing = false;
          next.testResult = `已读取 ${models.length} 个模型`;
          next.testResultTone = "success";
          next.draft.models = models;
          next.draft.modelCapabilities = Object.fromEntries(models.map((model) => [model, next.draft.modelCapabilities[model] || { visionInput: "auto", imageOutput: "auto" }]));
          next.draft.modelOverrides = Object.fromEntries(models.filter((model) => next.draft.modelOverrides[model]).map((model) => [model, next.draft.modelOverrides[model]]));
          if (!models.includes(next.draft.defaultModel)) next.draft.defaultModel = models[0] || "";
        });
        scheduleSave(true);
        toast(`读取到 ${models.length} 个模型`, { tone: "ok" });
        return;
      }
      const message = `${payload.message || "连接成功"} · 延迟 ${payload.latencyMs ?? "—"}ms`;
      update((next) => { next.testing = false; next.testResult = message; next.testResultTone = "success"; }, { preserveDirty: true });
      toast(payload.message || "连接成功", { tone: "ok" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (editorSession !== session || !editing()) return;
      update((next) => { next.testing = false; next.testResult = `测试失败：${message}`; next.testResultTone = "error"; }, { preserveDirty: true });
    }
  }

  async function testModel(model: string, signal: AbortSignal): Promise<string> {
    const error = validateProvider();
    if (error) throw new Error(error);
    const current = editing();
    if (!current || !current.draft.models.includes(model)) throw new Error("模型不存在");
    const response = await apiFetch("/api/providers/test", {
      method: "POST", signal,
      body: JSON.stringify({ id: current.mode === "edit" ? current.draft.id : "",
        displayName: current.draft.displayName, baseUrl: current.draft.baseUrl,
        responseFormat: current.draft.responseFormat, apiKey: current.apiKey, model })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    if (!payload.reply) throw new Error("接口未返回模型回复");
    return `响应成功 · ${payload.latencyMs ?? "—"}ms · ${payload.reply}`;
  }

  function upsertLocalProvider(provider: any): void {
    const providers = [...store.state.providers];
    const index = providers.findIndex((item: any) => item.id === provider.id);
    if (index >= 0) providers[index] = provider;
    else providers.push(provider);
    store.actions.setProviders(providers);
  }

  async function save(): Promise<boolean> {
    cancelSaveTimer();
    if (saveRunning) {
      const session = editorSession;
      const ok = await saveRunning;
      if (!ok || session !== editorSession) return ok;
      return editing()?.dirty ? save() : true;
    }
    const current = editing();
    if (!current || (!current.dirty && current.mode !== "new")) return true;
    if (composing) return false;
    saveRunning = persistProvider();
    try { return await saveRunning; } finally { saveRunning = null; }
  }

  async function persistProvider(): Promise<boolean> {
    const session = editorSession;
    if (!(await flushPendingApiKeySync()) || session !== editorSession) return false;
    const validationError = validateProvider();
    if (validationError) {
      update(next => { next.saveError = validationError; }, { preserveDirty: true }); return false;
    }
    const current = editing();
    if (!current) return false;
    const draft = normalizeProvider(current.draft);
    draft.systemPrompt = ""; draft.userId = ""; draft.temperature = 0.7; draft.topP = 1;
    draft.defaultReasoningEffort = ""; draft.streaming = true; draft.saveChats = true;
    draft.modelCapabilities = {};
    draft.modelOverrides = Object.fromEntries(Object.entries(draft.modelOverrides).map(([id, values]: [string, any]) => [id, Object.fromEntries(Object.entries(values).filter(([key]) => ["contextWindow", "maxTokens"].includes(key)))]));
    const submittedKey = current.apiKeyDirty ? current.apiKey.trim() : "";
    const controller = new AbortController();
    saveController = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    update(next => { next.saving = true; next.saveError = ""; }, { preserveDirty: true });
    try {
      if (current.mode === "new") attemptedRegistrations.add(draft.id);
      const response = await apiFetch("/api/providers", {
        method: "PUT", signal: controller.signal,
        body: JSON.stringify({ ...draft, settingsSchemaVersion: 1, apiKey: submittedKey || undefined })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.provider) throw new Error(payload.error || `HTTP ${response.status}`);
      if (session !== editorSession || !editing()) return false;
      const providerId = String(payload.provider.id || draft.id);
      const saved = normalizeProvider({ ...draft, ...payload.provider, id: providerId });
      upsertLocalProvider(saved);
      const oldCapabilities = store.state.modelCompatibility[current.draft.id] || {};
      const capabilities = Object.fromEntries(saved.models.flatMap((model: string) => {
        const entry = oldCapabilities[current.modelAliases[model] || model];
        return entry ? [[model, entry]] : [];
      }));
      store.state.modelCompatibility = { ...store.state.modelCompatibility, [saved.id]: capabilities };
      if (saved.id !== current.draft.id) delete store.state.modelCompatibility[current.draft.id];
      store.notify("chat-config");
      if (submittedKey) {
        try { await providerKeyVault.save(providerId, submittedKey); } catch {
          toast("后端已同步，前端 Key 加密副本保存失败", { tone: "danger" });
        }
      }
      if (!(await store.persist())) throw new Error("后端已保存，本地存储写入失败，请释放空间后重试");
      if (session !== editorSession || !editing()) return false;
      update(next => {
        next.mode = "edit";
        next.originalDraft = clone(saved);
        if (sameDraft(next.draft, current.draft)) { next.draft = clone(saved); next.modelAliases = {}; }
        else next.draft.id = providerId;
        if (next.apiKey === current.apiKey) next.apiKeyDirty = false;
        next.saving = false; next.saveError = "";
      });
      return true;
    } catch (error) {
      if (session === editorSession) update(next => {
        next.saving = false;
        next.saveError = `自动保存失败：${controller.signal.aborted ? "请求超时，请重试" : error instanceof Error ? error.message : String(error)}`;
      }, { preserveDirty: true });
      return false;
    } finally {
      clearTimeout(timeout);
      if (saveController === controller) saveController = null;
    }
  }

  async function remove(): Promise<boolean> {
    const current = editing();
    if (!current) return false;
    if (current.mode === "new" && validateProvider() && !attemptedRegistrations.has(current.draft.id)) {
      if (!(await dialogs.confirm({ title: "取消添加供应商", message: "放弃尚未完成的供应商配置？", confirmLabel: "放弃添加" }))) return false;
      cancelSaveTimer();
      stateBridge.patch({ providerEditing: null });
      return true;
    }
    const confirmed = await dialogs.confirm({
      title: "删除供应商",
      message: `「${current.draft.displayName}」的配置与后端 Key 会被移除；已有对话保留只读快照。`,
      confirmLabel: "删除",
      danger: true
    });
    if (!confirmed || editing()?.draft.id !== current.draft.id) return false;
    cancelSaveTimer();
    if (saveRunning) await saveRunning;
    cancelScheduledApiKeySync();
    await apiKeySyncQueue;
    try {
      const response = await apiFetch(`/api/providers/${encodeURIComponent(current.draft.id)}`, {
        method: "DELETE",
        body: JSON.stringify({ displayName: current.draft.displayName, baseUrl: current.draft.baseUrl })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok && !(current.mode === "new" && response.status === 404)) throw new Error(payload.error || `HTTP ${response.status}`);
      store.actions.setProviders(store.state.providers.filter((item: any) => item.id !== current.draft.id));
      try { await providerKeyVault.remove(current.draft.id); } catch { /* 后端删除已完成 */ }
      stateBridge.patch({ providerEditing: null });
      const compatibility = { ...store.state.modelCompatibility };
      delete compatibility[current.draft.id];
      store.state.modelCompatibility = compatibility;
      store.notify("chat-config");
      toast("供应商已删除", { tone: "ok" });
      return true;
    } catch (error) {
      toast(`删除失败：${error instanceof Error ? error.message : String(error)}`, { tone: "danger" });
      return false;
    }
  }

  return {
    beginNew, beginEdit, select, beforeNavigate, discard,
    capabilities: (providerId: string, model: string) => modelCompatibility(store.state, providerId, model),
    setField, toggleFlag, toggleKeyVisibility, setComposing, releaseEditor,
    openModel, openNewModel, openModelDefaults, closeModel,
    setModelField, toggleModelInheritance, applyModel,
    removeModel, setDefaultModel, testConnection, testModel, save, remove
  };
}
