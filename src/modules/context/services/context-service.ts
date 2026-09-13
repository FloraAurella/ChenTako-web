import { normalizeChatConfig, validateChatConfig, normalizeCompatibility, CHAT_CONFIG_DEFAULTS } from "../domain/config.js";
import type { ContextDraft, SettingsDependencies, SettingsStateBridge } from "../../../contracts/settings";
export type { ContextDraft } from "../../../contracts/settings";

export function createContextSettingsService({ store }: SettingsDependencies, bridge: SettingsStateBridge) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<boolean> | null = null;
  let session = 0;
  let composing = false;
  const serialize = (draft: Pick<ContextDraft, 'values' | 'compatibility'>) => JSON.stringify({ values: draft.values, compatibility: draft.compatibility });
  function cancelTimer() { if (timer) clearTimeout(timer); timer = null; }
  function schedule(immediate = false) {
    cancelTimer();
    if (composing) return;
    if (immediate) { void save(); return; }
    timer = setTimeout(() => { timer = null; void save(); }, 320);
  }
  function releaseEditor() { composing = false; cancelTimer(); session += 1; }
  function setComposing(value: boolean) { composing = value; if (value) cancelTimer(); else schedule(); }
  function begin(projectId = "") {
    cancelTimer(); session += 1;
    const project = store.state.projects.find((p: any) => p.id === projectId);
    const values = project ? { ...project.configOverrides } : normalizeChatConfig(store.state.chatConfig);
    const compatibility = normalizeCompatibility(store.state.modelCompatibility);
    bridge.patch({ contextEditing: { projectId: project?.id || "", values, compatibility, original: serialize({ values, compatibility }), dirty: false, saving: false, error: "" } });
  }
  function update(patch: Partial<ContextDraft>, immediate = false) {
    const current = bridge.get().contextEditing;
    if (!current) return;
    const next = { ...current, ...patch, error: "" };
    next.dirty = serialize(next) !== next.original;
    bridge.patch({ contextEditing: next });
    schedule(immediate);
  }
  function setField(key: string, value: unknown) {
    const current = bridge.get().contextEditing;
    if (current) update({ values: { ...current.values, [key]: value } }, typeof value === 'boolean');
  }
  function inherit(key: string) {
    const values = { ...bridge.get().contextEditing?.values };
    delete values[key]; update({ values }, true);
  }
  function reset() { update({ values: bridge.get().contextEditing?.projectId ? {} : { ...CHAT_CONFIG_DEFAULTS } }, true); }
  function setCapability(providerId: string, model: string, key: string, value: unknown) {
    const map = bridge.get().contextEditing?.compatibility || {};
    update({ compatibility: { ...map, [providerId]: { ...map[providerId], [model]: { ...map[providerId]?.[model], [key]: value } } } }, true);
  }
  async function beforeNavigate(target: any) {
    const current = bridge.get().contextEditing;
    if (!current) return true;
    if (target?.name === "settings" && target.settingsSection === "context" && (target.settingsProjectId || "") === current.projectId) return true;
    return save();
  }
  async function save(): Promise<boolean> {
    cancelTimer();
    if (running) {
      const generation = session;
      const ok = await running;
      if (!ok || generation !== session) return ok;
      return bridge.get().contextEditing?.dirty ? save() : true;
    }
    if (!bridge.get().contextEditing?.dirty) return true;
    if (composing) return false;
    running = persist();
    try { return await running; } finally { running = null; }
  }
  async function persist(): Promise<boolean> {
    const current = bridge.get().contextEditing;
    if (!current) return true;
    const generation = session;
    const error = validateChatConfig(current.values);
    const project = store.state.projects.find((p: any) => p.id === current.projectId);
    if (error || (current.projectId && !project)) {
      bridge.patch({ contextEditing: { ...current, error: error || "项目已删除，请返回聊天默认配置。" } }); return false;
    }
    bridge.patch({ contextEditing: { ...current, saving: true } });
    const old = { chatConfig: store.state.chatConfig, compatibility: store.state.modelCompatibility, overrides: project?.configOverrides };
    if (project) project.configOverrides = normalizeChatConfig(current.values, true);
    else store.state.chatConfig = normalizeChatConfig(current.values);
    store.state.modelCompatibility = normalizeCompatibility(current.compatibility);
    try {
      if (!(await store.persist())) throw new Error("本地存储写入失败，修改仍保留在表单中，请释放磁盘空间后重试。");
      if (generation === session) {
        const latest = bridge.get().contextEditing!;
        const original = serialize(current);
        bridge.patch({ contextEditing: { ...latest, original, dirty: serialize(latest) !== original, saving: false, error: "" } });
      }
      store.notify("chat-config");
      return true;
    } catch (error) {
      store.state.chatConfig = old.chatConfig;
      store.state.modelCompatibility = old.compatibility;
      if (project) project.configOverrides = old.overrides;
      if (generation === session) bridge.patch({ contextEditing: { ...bridge.get().contextEditing!, saving: false, error: error instanceof Error ? error.message : String(error) } });
      return false;
    }
  }
  return { begin, setField, inherit, reset, setCapability, save, beforeNavigate, releaseEditor, setComposing };
}
