import { useSyncExternalStore } from "react";

export interface StoreSnapshot<T> {
  version: number;
  value: T;
}

export interface ExternalStore {
  subscribeKey(key: string, listener: () => void): () => void;
  getSnapshot<T = unknown>(key?: string): StoreSnapshot<T>;
}

export function useStoreSnapshot<T>(store: ExternalStore, key: string): StoreSnapshot<T> {
  return useSyncExternalStore(
    (listener) => store.subscribeKey(key, listener),
    () => store.getSnapshot<T>(key),
    () => store.getSnapshot<T>(key)
  );
}

export function useStoreValue<T>(store: ExternalStore, key: string): T {
  return useStoreSnapshot<T>(store, key).value;
}
