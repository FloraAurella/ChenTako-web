/** Generic keyed snapshots; state shape and invalidation policy are supplied by App. */
export function createObservable(snapshotValue) {
 const subscribers = new Set(); const keyedSubscribers = new Map(); const keyedVersions = new Map(); const keyedSnapshots = new Map();
  function subscribe(listener) {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  }

  function subscribeKey(key, listener) {
    const normalized = String(key || "app");
    const listeners = keyedSubscribers.get(normalized) || new Set();
    listeners.add(listener);
    keyedSubscribers.set(normalized, listeners);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) keyedSubscribers.delete(normalized);
    };
  }

  function getSnapshot(key = "app") {
    const normalized = String(key || "app");
    const version = keyedVersions.get(normalized) || 0;
    const cached = keyedSnapshots.get(normalized);
    if (cached && cached.version === version) return cached;
    const snapshot = Object.freeze({ version, value: snapshotValue(normalized) });
    keyedSnapshots.set(normalized, snapshot);
    return snapshot;
  }

  function notifyKeys(keys, { includeApp = false } = {}) {
    const unique = new Set(keys.filter(Boolean).map(String));
    if (includeApp) unique.add("app");
    for (const key of unique) {
      keyedVersions.set(key, (keyedVersions.get(key) || 0) + 1);
      keyedSnapshots.delete(key);
      const listeners = keyedSubscribers.get(key);
      if (!listeners) continue;
      for (const listener of listeners) {
        try { listener(); } catch (error) {
          console.error("[Clawbox] keyed subscriber error", error);
        }
      }
    }
  }

function publish(reason,state) {
    for (const listener of subscribers) {
      try {
        listener(reason, state);
      } catch (error) {
        console.error("[Clawbox] subscriber error", error);
      }
    }
  }
return {subscribe,subscribeKey,getSnapshot,notifyKeys,publish};
}
