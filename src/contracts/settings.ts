export interface ContextDraft {
  projectId: string;
  values: Record<string, any>;
  compatibility: Record<string, any>;
  original: string;
  dirty: boolean;
  saving: boolean;
  error: string;
}
export type FeedbackTone = "info" | "ok" | "danger";
export type Feedback = (message: unknown, options?: { tone?: FeedbackTone }) => void;

export interface DialogManager {
  confirm(options: Record<string, unknown>): Promise<boolean>;
  prompt(options: Record<string, unknown>): Promise<string | null>;
  previewHtml(options: { source?: string; format?: "html" | "svg"; title?: string }): Promise<boolean>;
}

export interface SettingsDependencies {
  store: any;
  theme: any;
  dialogs: DialogManager;
  /** 兼容现有调用名；实现只显示 danger 内联错误，普通/成功反馈不再弹出。 */
  toast: Feedback;
}

export interface ProviderEditingState {
  mode: "new" | "edit";
  draft: any;
  originalDraft: any;
  dirty: boolean;
  modelAliases: Record<string, string>;
  apiKey: string;
  apiKeyVisible: boolean;
  apiKeyLoading: boolean;
  apiKeySyncing: boolean;
  apiKeyDirty: boolean;
  testing: boolean;
  testResult: string;
  testResultTone: "" | "info" | "success" | "error";
  modelEditing: ProviderModelEditingState | null;
}

export type ModelParameterKey = "contextWindow" | "maxTokens";

export interface ProviderModelEditingState {
  mode: "new" | "edit" | "defaults";
  originalId: string;
  error: string;
  draft: {
    id: string;
    contextWindow: string;
    maxTokens: string;
    inherit: Record<ModelParameterKey, boolean>;
  };
}

export interface ExtensionEditingState {
  kind: "tool";
  mode: "new" | "edit";
  draft: any;
  schemaText: string;
  /** 最近一次保存失败的可见原因（表单内联显示）。 */
  saveError: string | null;
}

export interface MigrationResult {
  status?: string;
  message?: string;
  outputPath?: string;
  backupPath?: string;
  dataPath?: string;
  cancelled?: boolean;
}

export interface MigrationStatus {
  available: boolean;
  reason?: string;
  dataLocation?: string;
  themeArchivePath?: string;
  encryption?: string;
  keyBits?: number;
  lastResult?: MigrationResult | null;
}

export interface MigrationBridge {
  getStatus(): Promise<MigrationStatus>;
  createPackage(): Promise<MigrationResult>;
  revealLastResult(): Promise<boolean>;
}

export function getMigrationBridge(): MigrationBridge | undefined {
  return (window as unknown as { clawbox?: { migration?: MigrationBridge } })
    .clawbox?.migration;
}

export interface SettingsState {
  contextEditing: ContextDraft | null;
  providerEditing: ProviderEditingState | null;
  extensionEditing: ExtensionEditingState | null;
  migrationStatus: MigrationStatus | null;
  migrationLoading: boolean;
  migrationBusy: boolean;
  themePackageBusy: boolean;
  appearanceOverride: {
    themeId: string;
    scheme: "light" | "dark";
    contrast?: number;
    transparent?: boolean;
  } | null;
}

export interface SettingsSnapshot {
  version: number;
  value: SettingsState;
}

export interface SettingsStateBridge {
  get(): SettingsState;
  patch(patch: Partial<SettingsState>): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): SettingsSnapshot;
}

export function createSettingsStateBridge(): SettingsStateBridge {
  const listeners = new Set<() => void>();
  let version = 0;
  let value: SettingsState = {
    contextEditing: null,
    providerEditing: null,
    extensionEditing: null,
    migrationStatus: typeof window !== "undefined" && getMigrationBridge()
      ? null
      : {
          available: false,
          reason: "迁移仅适用于打包后的 Clawbox macOS 桌面版。",
          dataLocation: "",
          themeArchivePath: "",
          encryption: "",
          keyBits: 0,
          lastResult: null
        },
    migrationLoading: false,
    migrationBusy: false,
    themePackageBusy: false,
    appearanceOverride: null
  };
  let snapshot: SettingsSnapshot = Object.freeze({ version, value });

  return {
    get: () => value,
    patch(patch) {
      value = Object.freeze({ ...value, ...patch });
      version += 1;
      snapshot = Object.freeze({ version, value });
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot
  };
}
