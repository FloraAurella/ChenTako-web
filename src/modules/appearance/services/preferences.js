import { createSafeStorage } from '../../../shared/storage/safe-storage.js';
import { STORAGE_KEYS,THEME_BACKGROUND_DB } from '../../../contracts/constants.js';
import { isValidThemeId } from '../domain/contract.js';
export function createThemeBackgroundArchive() {
  const supported = typeof indexedDB !== "undefined" && typeof IDBKeyRange !== "undefined";

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!supported) {
        reject(new Error("当前环境不支持 IndexedDB"));
        return;
      }
      const request = indexedDB.open(THEME_BACKGROUND_DB.name, 1);
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("IndexedDB 打开超时"));
      }, 4000);
      const settle = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(THEME_BACKGROUND_DB.store)) {
          db.createObjectStore(THEME_BACKGROUND_DB.store);
        }
      };
      request.onsuccess = () => settle(resolve, request.result);
      request.onerror = () => settle(reject, request.error || new Error("IndexedDB 打开失败"));
      request.onblocked = () => settle(reject, new Error("IndexedDB 打开被其他页面阻塞"));
    });
  }

  function withStore(mode, operate) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(THEME_BACKGROUND_DB.store, mode);
      const request = operate(tx.objectStore(THEME_BACKGROUND_DB.store));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error || new Error("IndexedDB 事务失败"));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB 事务中止"));
    }).finally(() => db.close()));
  }

  return {
    supported,
    /** 全部主题记录 → { [themeId]: prefs }（getAllKeys 与 getAll 同事务内按相同 key 顺序对应）。 */
    async loadAll() {
      const db = await openDb();
      try {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(THEME_BACKGROUND_DB.store, "readonly");
          const store = tx.objectStore(THEME_BACKGROUND_DB.store);
          const keysRequest = store.getAllKeys();
          const valuesRequest = store.getAll();
          tx.oncomplete = () => {
            const out = {};
            const keys = keysRequest.result || [];
            const values = valuesRequest.result || [];
            keys.forEach((key, index) => { out[key] = values[index]; });
            resolve(out);
          };
          tx.onerror = () => reject(tx.error || new Error("IndexedDB 事务失败"));
          tx.onabort = () => reject(tx.error || new Error("IndexedDB 事务中止"));
        });
      } finally {
        db.close();
      }
    },
    save(themeId, prefs) {
      return withStore("readwrite", (store) => store.put(prefs, themeId));
    },
    remove(themeId) {
      return withStore("readwrite", (store) => store.delete(themeId));
    }
  };
}

// ---- UI 偏好（主题 / 明暗 / 抽屉） ----

const APPEARANCE_MODES = ["system", "light", "dark"];

export function readUiPreferences(safeStorage) {
  const storage = safeStorage || createSafeStorage();
  let raw = null;
  try {
    raw = JSON.parse(storage.getItem(STORAGE_KEYS.uiPreferences) || "");
  } catch { /* 损坏的偏好按空处理 */ }
  const source = raw && typeof raw === "object" ? raw : {};
  const prefs = {
    themeId: isValidThemeId(source.themeId) ? source.themeId : "",
    appearanceMode: APPEARANCE_MODES.includes(source.appearanceMode) ? source.appearanceMode : "system",
    drawerCollapsed: source.drawerCollapsed === true
  };
  if (!prefs.themeId && typeof source.themeFamily === "string") {
    prefs.legacyThemeFamily = source.themeFamily;
  }
  if (!APPEARANCE_MODES.includes(source.appearanceMode) && typeof source.appearanceMode === "string") {
    prefs.legacyAppearanceMode = source.appearanceMode;
  }
  return prefs;
}

export function writeUiPreferences(prefs, safeStorage) {
  const storage = safeStorage || createSafeStorage();
  const payload = {
    themeId: isValidThemeId(prefs.themeId) ? prefs.themeId : "",
    appearanceMode: APPEARANCE_MODES.includes(prefs.appearanceMode) ? prefs.appearanceMode : "system",
    drawerCollapsed: prefs.drawerCollapsed === true,
    savedAt: Date.now()
  };
  try {
    storage.setItem(STORAGE_KEYS.uiPreferences, JSON.stringify(payload));
  } catch { /* 存储不可用：偏好仅存于本次会话 */ }
  return payload;
}

