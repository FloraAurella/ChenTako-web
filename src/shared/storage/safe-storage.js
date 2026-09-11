export const LEGACY_STORAGE_PREFIXES = Object.freeze([
  "ai-chatbox-structure-",
  "kotoba-",
  "perabox-"
]);

export const STORAGE_PROBE_KEY = "__clawbox_probe__";

/** 移除历史项目遗留键，返回删除数量。只匹配明确的前身命名空间。 */
export function evictLegacyStorage(storage) {
  let removed = 0;
  try {
    const keys = [];
    for (let index = 0; index < storage.length; index++) keys.push(storage.key(index));
    for (const key of keys) {
      if (key && LEGACY_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        storage.removeItem(key);
        removed += 1;
      }
    }
  } catch { /* 清理失败不影响主流程 */ }
  return removed;
}

export function createSafeStorage() {
  const memory = new Map();
  // degraded=true 表示真实 localStorage 上次写入失败（配额满/隐私模式），
  // 当前读写退化为内存副本；后续写入成功会自动恢复健康。
  let degraded = false;
  let evictionAttempted = false;
  let realAvailable = false;

  function probeReal() {
    try {
      if (typeof localStorage === "undefined") return false;
      localStorage.setItem(STORAGE_PROBE_KEY, "1");
      localStorage.removeItem(STORAGE_PROBE_KEY);
      return true;
    } catch { return false; }
  }

  function writeReal(key, value) {
    try {
      localStorage.setItem(key, value);
      degraded = false;
      return true;
    } catch {
      // 首次写入失败时尝试一次遗留键清理（历史项目残留可能挤占配额），再试一次。
      if (!evictionAttempted) {
        evictionAttempted = true;
        evictLegacyStorage(localStorage);
        try {
          localStorage.setItem(key, value);
          degraded = false;
          return true;
        } catch { /* 仍然失败 */ }
      }
      degraded = true;
      return false;
    }
  }

  realAvailable = probeReal();

  return {
    get degraded() { return degraded; },
    get available() { return realAvailable; },
    getItem(key) {
      if (memory.has(key)) return memory.get(key);
      // 配额问题只影响写入；读取真实数据始终尽力尝试（恢复旧会话内容）。
      try { return localStorage.getItem(key); } catch { return null; }
    },
    setItem(key, value) {
      // 内存副本无条件保留：即使磁盘写入失败，本次会话仍能读回。
      memory.set(key, String(value));
      if (!writeReal(key, String(value))) {
        // 磁盘不可写但可能只是暂时（例如配额被其他标签页占用后释放），
        // 保留 degraded 标记，调用方可据此提示或降级。
      }
    },
    removeItem(key) {
      memory.delete(key);
      try { localStorage.removeItem(key); } catch { /* 忽略 */ }
    },
    /** 供诊断/测试：当前是否处于内存降级。 */
    isDegraded() { return degraded; }
  };
}

// ---- IndexedDB 归档（object store `state`，key `current`，串行写队列） ----

