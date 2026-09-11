"use strict";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Vitest 环境 polyfill：部分环境（Node / 旧 jsdom）缺 localStorage 与
 * Blob.arrayBuffer，这里补齐最小实现，保证 core 层测试可移植。
 */

if (typeof globalThis.localStorage === "undefined" || globalThis.localStorage === null) {
  class LocalStorageShim {
    constructor() {
      this.map = new Map();
    }
    get length() {
      return this.map.size;
    }
    key(index) {
      const keys = [...this.map.keys()];
      return index >= 0 && index < keys.length ? keys[index] : null;
    }
    getItem(key) {
      return this.map.has(String(key)) ? this.map.get(String(key)) : null;
    }
    setItem(key, value) {
      this.map.set(String(key), String(value));
    }
    removeItem(key) {
      this.map.delete(String(key));
    }
    clear() {
      this.map.clear();
    }
  }
  globalThis.localStorage = new LocalStorageShim();
}
