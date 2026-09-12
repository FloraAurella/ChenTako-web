"use strict";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Vitest 环境 polyfill：部分环境（Node / 旧 jsdom）缺 localStorage 与
 * Blob.arrayBuffer，这里补齐最小实现，保证 core 层测试可移植。
 */

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

// Node ≥22 暴露实验性的全局 localStorage：无 --localstorage-file 时读取 getter
// 即触发 ExperimentalWarning，因此不能用 typeof 探测（旧实现正是靠这次读取
// 触发警告后回落 shim）。这里改用属主描述符识别：getter / 缺失 / 空值都视为
// 不可用，统一安装测试专用的显式实现；真实存储环境不受影响。
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const storageUnavailable =
  !storageDescriptor ||
  typeof storageDescriptor.get === "function" ||
  storageDescriptor.value === undefined ||
  storageDescriptor.value === null;
if (storageUnavailable) {
  Object.defineProperty(globalThis, "localStorage", {
    value: new LocalStorageShim(),
    configurable: true,
    writable: true
  });
}
