import {
  createExtensionDraft,
  EXTENSION_LIMITS,
  normalizeExtensions,
  validateExtensionDraft
} from "../domain/model.js";
import { parseSkillMarkdownFile, parseSkillPackageFile } from "../domain/skill-package.js";
import type {
  ExtensionEditingState,
  SettingsDependencies,
  SettingsStateBridge
} from "../../../contracts/settings";

export type ExtensionKind = "tool" | "skill";

export const EXTENSION_KIND_META = Object.freeze({
  tool: { key: "tools", label: "Tool", pluralLabel: "Tools", icon: "puzzle" },
  skill: { key: "skills", label: "Skill", pluralLabel: "Skills", icon: "spark" }
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createExtensionSettingsService(
  dependencies: SettingsDependencies,
  stateBridge: SettingsStateBridge
) {
  const { store, dialogs, toast } = dependencies;

  const registry = () => normalizeExtensions(store.state.extensions);
  const editing = () => stateBridge.get().extensionEditing;

  function update(mutator: (next: ExtensionEditingState) => void): void {
    const current = editing();
    if (!current) return;
    const next: ExtensionEditingState = {
      ...current,
      draft: clone(current.draft)
    };
    mutator(next);
    stateBridge.patch({ extensionEditing: next });
  }

  function begin(kind: ExtensionKind, id = ""): void {
    if (kind === "skill") return;
    const meta = EXTENSION_KIND_META[kind];
    const currentRegistry: any = registry();
    const entries = currentRegistry[meta.key];
    const existing = id ? entries.find((entry: any) => entry.id === id) : null;
    const limit = (EXTENSION_LIMITS as any)[meta.key];
    if (!existing && entries.length >= limit) {
      toast(`${meta.label} 最多只能保存 ${limit} 项`, { tone: "danger" });
      return;
    }
    const draft = existing ? clone(existing) : createExtensionDraft(kind);
    stateBridge.patch({
      extensionEditing: {
        kind,
        mode: existing ? "edit" : "new",
        draft,
        schemaText: kind === "tool" ? JSON.stringify(draft.inputSchema, null, 2) : "",
        saveError: null
      }
    });
  }

  function cancel(): void {
    stateBridge.patch({ extensionEditing: null });
  }

  function setField(key: string, value: string): void {
    update((next) => {
      next.draft[key] = value;
      next.saveError = null;
    });
  }

  function setSchema(value: string): void {
    update((next) => {
      next.schemaText = value;
      next.saveError = null;
    });
  }

  function toggleDraftEnabled(): void {
    update((next) => { next.draft.enabled = !next.draft.enabled; });
  }

  function parsedDraft(): { error: string; draft: any | null } {
    const current = editing();
    if (!current) return { error: "没有正在编辑的扩展", draft: null };
    const draft = { ...current.draft };
    if (current.kind === "tool") {
      try {
        draft.inputSchema = JSON.parse(current.schemaText);
      } catch {
        return { error: "输入 Schema 不是有效 JSON", draft: null };
      }
      if (!draft.inputSchema || typeof draft.inputSchema !== "object" || Array.isArray(draft.inputSchema) || draft.inputSchema.type !== "object") {
        return { error: "输入 Schema 的根节点必须是 type 为 object 的 JSON 对象", draft: null };
      }
      if (new TextEncoder().encode(JSON.stringify(draft.inputSchema)).length > EXTENSION_LIMITS.schemaChars) {
        return { error: `输入 Schema 不能超过 ${Math.floor(EXTENSION_LIMITS.schemaChars / 1024)}KB`, draft: null };
      }
    }
    return { error: validateExtensionDraft(current.kind, draft, registry() as any), draft };
  }

  function save(): void {
    const current = editing();
    const parsed = parsedDraft();
    if (!current || parsed.error || !parsed.draft) {
      const message = parsed.error || "扩展配置无效";
      // 表单保存错误保留在操作区；全局浮动通知已关闭。
      update((next) => { next.saveError = message; });
      return;
    }
    const meta = EXTENSION_KIND_META[current.kind];
    const currentRegistry: any = registry();
    const entries = [...currentRegistry[meta.key]];
    const index = entries.findIndex((entry: any) => entry.id === parsed.draft.id);
    if (index >= 0) entries[index] = parsed.draft;
    else entries.push(parsed.draft);
    currentRegistry[meta.key] = entries;
    store.actions.setExtensions(currentRegistry);
    stateBridge.patch({ extensionEditing: null });
    toast(`${meta.label} 已保存`, { tone: "ok" });
  }

  function toggle(kind: ExtensionKind, id: string): void {
    const meta = EXTENSION_KIND_META[kind];
    const currentRegistry: any = registry();
    const entries = [...currentRegistry[meta.key]];
    const index = entries.findIndex((entry: any) => entry.id === id);
    if (index < 0) return;
    entries[index] = { ...entries[index], enabled: !entries[index].enabled };
    currentRegistry[meta.key] = entries;
    store.actions.setExtensions(currentRegistry);
    toast(`${meta.label} 已${entries[index].enabled ? "启用" : "停用"}`);
  }

  function toggleRuntime(kind: "sandbox" | "codeInterpreter"): void {
    const currentRegistry: any = registry();
    currentRegistry[kind] = { enabled: !currentRegistry[kind].enabled };
    store.actions.setExtensions(currentRegistry);
    toast(`${kind === "sandbox" ? "运行时沙箱" : "Linux Python 代码解释器"}已${currentRegistry[kind].enabled ? "启用" : "停用"}`);
  }

  async function remove(kind: ExtensionKind, id: string): Promise<void> {
    const meta = EXTENSION_KIND_META[kind];
    const currentRegistry: any = registry();
    const entry = currentRegistry[meta.key].find((item: any) => item.id === id);
    if (!entry) return;
    const confirmed = await dialogs.confirm({
      title: `删除${meta.label}`,
      message: `「${entry.name}」将从本机扩展注册表移除，并从下一次对话请求起停止生效。`,
      confirmLabel: "删除",
      danger: true
    });
    if (!confirmed) return;
    currentRegistry[meta.key] = currentRegistry[meta.key].filter((item: any) => item.id !== id);
    store.actions.setExtensions(currentRegistry);
    toast(`${meta.label} 已删除`);
  }

  function installSkills(definitions: any[], sourceLabel: string): void {
    if (!definitions.length) throw new Error("没有可导入的 Skill");
    const currentRegistry: any = registry();
    const available = EXTENSION_LIMITS.skills - currentRegistry.skills.length;
    if (definitions.length > available) {
      throw new Error(`当前还能导入 ${Math.max(0, available)} 个 Skill，导入文件包含 ${definitions.length} 个`);
    }
    const entries = definitions.map((definition) => ({
      ...createExtensionDraft("skill"),
      name: definition.name,
      description: definition.description,
      instructions: definition.instructions,
      enabled: true
    }));
    currentRegistry.skills = [...currentRegistry.skills, ...entries];
    store.actions.setExtensions(currentRegistry);
    toast(`已从 ${sourceLabel} 导入 ${entries.length} 个 Skill`, { tone: "ok" });
  }

  async function importSkillMarkdown(files: FileList | File[]): Promise<void> {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    try {
      const definitions = [];
      for (const file of selected) definitions.push(await parseSkillMarkdownFile(file));
      installSkills(definitions, "Markdown");
    } catch (error) {
      toast(`Markdown Skill 导入失败：${error instanceof Error ? error.message : "文件格式不可用"}`, { tone: "danger" });
    }
  }

  async function importSkillPackage(file?: File | null): Promise<void> {
    if (!file) return;
    try {
      installSkills(await parseSkillPackageFile(file), "压缩包");
    } catch (error) {
      toast(`Skill 压缩包导入失败：${error instanceof Error ? error.message : "压缩包格式不可用"}`, { tone: "danger" });
    }
  }

  return {
    begin,
    cancel,
    setField,
    setSchema,
    toggleDraftEnabled,
    save,
    toggle,
    toggleRuntime,
    remove,
    importSkillMarkdown,
    importSkillPackage
  };
}
