import { normalizeChatConfig, validateChatConfig, normalizeCompatibility, CHAT_CONFIG_DEFAULTS } from "../domain/config.js";
import type { SettingsDependencies, SettingsStateBridge } from "../../../contracts/settings";

import type { ContextDraft } from "../../../contracts/settings";
export type { ContextDraft } from "../../../contracts/settings";
export function createContextSettingsService({ store, dialogs }: SettingsDependencies, bridge: SettingsStateBridge) {
  function begin(projectId = "") {
    const project = store.state.projects.find((p: any) => p.id === projectId);
    const values = project ? { ...project.configOverrides } : normalizeChatConfig(store.state.chatConfig);
    const compatibility = normalizeCompatibility(store.state.modelCompatibility);
    bridge.patch({ contextEditing: { projectId: project?.id || "", values, compatibility, original: JSON.stringify({ values, compatibility }), dirty: false, saving: false, error: "" } });
  }
  function update(patch: Partial<ContextDraft>) {
    const current = bridge.get().contextEditing;
    if (!current || current.saving) return;
    const next = { ...current, ...patch, error: "" };
    next.dirty = JSON.stringify({ values: next.values, compatibility: next.compatibility }) !== next.original;
    bridge.patch({ contextEditing: next });
  }
  function setField(key: string, value: unknown) {
    const current = bridge.get().contextEditing;
    if (current) update({ values: { ...current.values, [key]: value } });
  }
  function inherit(key: string) {
    const values = { ...bridge.get().contextEditing?.values };
    delete values[key]; update({ values });
  }
  function reset() { update({ values: bridge.get().contextEditing?.projectId ? {} : { ...CHAT_CONFIG_DEFAULTS } }); }
  function setCapability(providerId: string, model: string, key: string, value: unknown) {
    const map = bridge.get().contextEditing?.compatibility || {};
    update({ compatibility: { ...map, [providerId]: { ...map[providerId], [model]: { ...map[providerId]?.[model], [key]: value } } } });
  }
  async function beforeNavigate(target: any) {
    const current = bridge.get().contextEditing;
    if (!current) return true;
    if (current.saving) return false;
    if (target?.name === "settings" && target.settingsSection === "context" && (target.settingsProjectId || "") === current.projectId) return true;
    return !current.dirty || dialogs.confirm({ title: "有未保存的修改", message: "离开会放弃尚未保存的上下文与提示词配置。", confirmLabel: "放弃修改" });
  }
  async function save() {
    const current = bridge.get().contextEditing;
    if (!current || current.saving) return;
    const error = validateChatConfig(current.values);
    const project = store.state.projects.find((p: any) => p.id === current.projectId);
    if (error || (current.projectId && !project)) {
      bridge.patch({ contextEditing: { ...current, error: error || "项目已删除，请返回聊天默认配置。" } }); return;
    }
    bridge.patch({ contextEditing: { ...current, saving: true } });
    const old = { chatConfig: store.state.chatConfig, compatibility: store.state.modelCompatibility, overrides: project?.configOverrides };
    if (project) project.configOverrides = normalizeChatConfig(current.values, true);
    else store.state.chatConfig = normalizeChatConfig(current.values);
    store.state.modelCompatibility = normalizeCompatibility(current.compatibility);
    try {
      if (!(await store.persist())) throw new Error("本地存储写入失败，修改仍保留在表单中，请释放磁盘空间后重试。");
      begin(current.projectId);
      store.notify("chat-config");
    } catch (error) {
      store.state.chatConfig = old.chatConfig;
      store.state.modelCompatibility = old.compatibility;
      if (project) project.configOverrides = old.overrides;
      bridge.patch({ contextEditing: { ...current, saving: false, error: error instanceof Error ? error.message : String(error) } });
    }
  }
  return { begin, setField, inherit, reset, setCapability, save, beforeNavigate };
}
