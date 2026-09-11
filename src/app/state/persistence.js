import { createSafeStorage } from "../../shared/storage/safe-storage.js";
"use strict";

/**
 * 双轨持久化：IndexedDB（完整归档）+ localStorage（轻量备份）。
 * 键名与改名前版本完全一致（tribblebook-state-v1 / tribblebook-v6-state /
 * tribblebook-app-mode / tribblebook-ui-preferences-v1），保证旧数据可直接读取。
 */

import { STORAGE_KEYS, STATE_DB, THEME_BACKGROUND_DB, APP_VERSION } from "../../contracts/constants.js";
import { normalizeConversation, normalizeProvider } from "../../contracts/normalize.js";
import { normalizeProjects, normalizeProjectSidebar } from "../../modules/projects/public/domain_model.js";
import { migrateChatSettings, normalizeChatConfig, normalizeCompatibility, SETTINGS_SCHEMA_VERSION } from "../../modules/context/public/domain_config.js";
import { normalizeExtensions } from "../../modules/extensions/public/domain_model.js";
import { isValidThemeId } from "../../modules/appearance/public/domain_contract.js";

// ---- localStorage 安全封装（配额耗尽/不可用时降级内存 Map，并支持自愈恢复） ----

/**
 * 早期原型阶段遗留的命名空间。同源曾被多个前身项目共用，遗留数据可能把
 * localStorage 配额挤占殆尽；写入失败时按序清理这些键（绝不触碰当前键）。
 */
export { LEGACY_STORAGE_PREFIXES, STORAGE_PROBE_KEY, evictLegacyStorage, createSafeStorage } from "../../shared/storage/safe-storage.js";
export function createStateArchive({ openTimeoutMs = 4000 } = {}) {
  const queue = [];
  let writing = false;

  const supported = typeof indexedDB !== "undefined" && typeof IDBKeyRange !== "undefined";

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!supported) {
        reject(new Error("当前环境不支持 IndexedDB"));
        return;
      }
      const request = indexedDB.open(STATE_DB.name, 1);
      let settled = false;
      // open 请求可能永不回调（数据库损坏、被其他窗口无限期阻塞）。
      // 不设超时会同时拖死加载与整条写队列；超时后按失败处理。
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("IndexedDB 打开超时"));
      }, openTimeoutMs);
      const settle = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STATE_DB.store)) {
          db.createObjectStore(STATE_DB.store);
        }
      };
      request.onsuccess = () => {
        if (settled) {
          request.result.close();
          return;
        }
        settle(resolve, request.result);
      };
      request.onerror = () => {
        settle(reject, request.error || new Error("IndexedDB 打开失败"));
      };
      request.onblocked = () => {
        settle(reject, new Error("IndexedDB 打开被其他页面阻塞"));
      };
    });
  }

  function runTransaction(db, mode, operate) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STATE_DB.store, mode);
      const store = tx.objectStore(STATE_DB.store);
      const request = operate(store);
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error || new Error("IndexedDB 事务失败"));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB 事务中止"));
    });
  }

  async function drain() {
    if (writing) return;
    writing = true;
    try {
      while (queue.length) {
        const task = queue.shift();
        let db = null;
        try {
          db = await openDb();
          const result = await runTransaction(db, "readwrite", (store) => store.put(task.payload, STATE_DB.key));
          task.resolve(result);
        } catch (error) {
          // 打开数据库也可能失败。必须拒绝当前任务并继续排空队列；否则 writing
          // 会永久保持 true，之后供应商、Tool、Skill 的保存都会被卡住。
          task.reject(error);
        } finally {
          db?.close();
        }
      }
    } finally {
      writing = false;
      // finally 执行前若有新任务入队，启动下一轮，避免错过并发 save。
      if (queue.length) void drain();
    }
  }

  return {
    supported,
    save(payload) {
      return new Promise((resolve, reject) => {
        queue.push({ payload, resolve, reject });
        void drain();
      });
    },
    async load() {
      if (!supported) return null;
      const db = await openDb().catch(() => null);
      if (!db) return null;
      try {
        const value = await runTransaction(db, "readonly", (store) => store.get(STATE_DB.key));
        return value && typeof value === "object" ? value : null;
      } catch {
        return null;
      } finally {
        db.close();
      }
    }
  };
}

// ---- IndexedDB 主题背景（object store `themes`，每主题一条，key = 主题 ID） ----

export { createThemeBackgroundArchive,readUiPreferences,writeUiPreferences } from "../../modules/appearance/public/services_preferences.js";
// ---- 应用模式（首版仅开放 Chat） ----

export function readAppMode(safeStorage) {
  void safeStorage;
  return "chat";
}

export function writeAppMode(mode, safeStorage) {
  void mode;
  const storage = safeStorage || createSafeStorage();
  try {
    storage.setItem(STORAGE_KEYS.appMode, "chat");
  } catch { /* 忽略 */ }
}

// ---- 状态载荷 ----

const DISABLED_PROVIDER_IDS = new Set([
  "demo-openai-compatible",
  "demo-responses",
  "demo-anthropic",
  "demo-google",
  "test-responses"
]);
const DISABLED_PROVIDER_BASE_URLS = new Set(["https://api.test-chatbox.florasunshina.io/v1"]);

function normalizePayloadShape(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const settings = migrateChatSettings(source);
  const normalizedProviders = (Array.isArray(source.providers) ? source.providers : [])
    .filter((provider) => provider && typeof provider === "object" && !Array.isArray(provider))
    .map((provider) => normalizeProvider(provider));
  const providers = normalizedProviders.filter((provider) => (
    !DISABLED_PROVIDER_IDS.has(provider.id) &&
    !DISABLED_PROVIDER_BASE_URLS.has(String(provider.baseUrl || "").replace(/\/+$/, ""))
  ));
  const requestedActiveProviderId = String(source.activeProviderId || "");
  const activeProviderId = providers.some((provider) => (
    provider.id === requestedActiveProviderId && provider.enabled !== false
  ))
    ? requestedActiveProviderId
    : (providers.find((provider) => provider.enabled !== false)?.id || "");
  const conversations = (Array.isArray(source.conversations) ? source.conversations : [])
    .map((conversation) => normalizeConversation(conversation));
  const projects = normalizeProjects(source.projects);
  const projectIds = new Set(projects.map((project) => project.id));
  conversations.forEach((conversation) => {
    if (settings.settingsMigrationApplied) {
      conversation.reasoningEffortOverride = null;
      conversation.saveChats = conversation.saveChats !== false && normalizedProviders.find((p) => p.id === conversation.providerId)?.saveChats !== false;
    }
    if (!projectIds.has(conversation.projectId)) conversation.projectId = null;
  });
  return {
    version: APP_VERSION,
    ...settings,
    projects,
    projectSidebar: normalizeProjectSidebar(source.projectSidebar),
    conversations,
    providers,
    extensions: normalizeExtensions(source.extensions),
    activeConversationId: String(source.activeConversationId || ""),
    activeProviderId,
    preferredReasoningEffort: String(source.preferredReasoningEffort || "medium"),
    retiredProviderMigrationApplied: providers.length !== normalizedProviders.length
  };
}

/**
 * 读取持久化状态：IndexedDB 与 localStorage 双通道都读取，按 savedAt 取较新一份。
 * 任何一层失败（损坏、超时、毒化数据）都降级到另一层，绝不抛错或挂起。
 * 关键：IDB 写失败而 localStorage 成功时，陈旧的 IDB 记录绝不能覆盖新鲜备份——
 * 否则表现为“保存后重启，改动全部丢失”。
 */
export async function loadPersistedState() {
  const archive = createStateArchive();
  const storage = createSafeStorage();

  const [idbResult, lsResult] = await Promise.all([
    archive.load().then(
      (value) => ({ payload: value && typeof value === "object" ? value : null, error: null }),
      (error) => ({ payload: null, error })
    ),
    Promise.resolve().then(() => {
      const raw = storage.getItem(STORAGE_KEYS.state);
      if (!raw) return { payload: null, error: null };
      try { return { payload: JSON.parse(raw), error: null }; } catch (error) { return { payload: null, error }; }
    })
  ]);

  if (idbResult.error) {
    console.warn("[Clawbox] IndexedDB 归档读取失败，回退本地备份", idbResult.error);
  }
  const idbPayload = idbResult.payload;
  const lsPayload = lsResult.payload && typeof lsResult.payload === "object" ? lsResult.payload : null;
  const idbTime = Number(idbPayload && idbPayload.savedAt) || 0;
  // localStorage 写满时的降级骨架（conversations 被清空）只用于保住配置；
  // 若存在更旧但完整的 IDB 归档，让位给完整记录。
  const lsTime = lsPayload && lsPayload.degraded === true ? 0 : (Number(lsPayload && lsPayload.savedAt) || 0);

  const normalize = (payload) => normalizePayloadShape(payload);

  // 双通道都有数据：savedAt 较新者胜出（并列时 IDB 优先，其记录更完整）。
  if (idbPayload && (!lsPayload || idbTime >= lsTime)) {
    try { return normalize(idbPayload); } catch { /* IDB 记录损坏：尝试本地备份 */ }
  }
  if (lsPayload) {
    try { return normalize(lsPayload); } catch { /* 本地备份损坏 */ }
  }
  if (idbPayload) {
    try { return normalize(idbPayload); } catch { /* 两层都损坏 */ }
  }
  return null;
}

/**
 * 循环引用 / BigInt 安全序列化。历史会话数据一旦混入自引用对象，
 * 普通 JSON.stringify 会抛错并让整条持久化链路静默中断；这里保证备份通道始终能产出内容。
 */
export function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch { /* 进入降级序列化 */ }
  const seen = new WeakSet();
  return JSON.stringify(value, (key, item) => {
    if (typeof item === "bigint") return item.toString();
    if (typeof item === "object" && item !== null) {
      if (seen.has(item)) return "[circular]";
      seen.add(item);
    }
    return item;
  });
}

/** 完整载荷：过滤 saveChats=false 的供应商会话。 */
export function buildPersistentPayload(state) {
  const providerById = new Map(state.providers.map((provider) => [provider.id, provider]));
  const conversations = state.conversations.filter((conversation) => {
    if (conversation.saveChats === false) return false;
    const provider = providerById.get(conversation.providerId);
    if (conversation.saveChats == null && provider?.saveChats === false) return false;
    return true;
  });
  const keptIds = new Set(conversations.map((conversation) => conversation.id));
  const activeConversationId = keptIds.has(state.activeConversationId)
    ? state.activeConversationId
    : (conversations[0] ? conversations[0].id : "");
  return {
    version: APP_VERSION,
    savedAt: Date.now(),
    settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
    chatConfig: normalizeChatConfig(state.chatConfig),
    modelCompatibility: normalizeCompatibility(state.modelCompatibility),
    legacySettingsBackup: state.legacySettingsBackup || null,
    projects: normalizeProjects(state.projects),
    projectSidebar: normalizeProjectSidebar(state.sidebar),
    conversations,
    providers: state.providers.map((provider) => ({ ...provider })),
    extensions: normalizeExtensions(state.extensions),
    activeConversationId,
    activeProviderId: state.activeProviderId,
    preferredReasoningEffort: state.preferredReasoningEffort
  };
}

/** 轻量备份：剥离图片/文件 data URL 与附件正文，控制 localStorage 体积。 */
export function buildLightweightPayload(payload) {
  return {
    ...payload,
    lightweight: true,
    conversations: payload.conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => ({
        ...message,
        files: (message.files || []).map((file) => ({ name: file.name, text: "" })),
        parts: (message.parts || []).map((part) => (
          part.type === "image"
            ? {
              type: "image",
              source: "",
              mimeType: part.mimeType,
              alt: part.alt || "图片",
              stripped: true
            }
            : part.type === "file"
              ? { type: "file", name: part.name, mimeType: part.mimeType, source: "", size: part.size, stripped: true }
              : part
        ))
      }))
    }))
  };
}
