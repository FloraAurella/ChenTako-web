"use strict";

/**
 * ChenTako 主题包：一个不依赖 ZIP 的小型二进制容器。
 *
 * 文件布局（小端）：
 *   8 bytes  魔数 PBOXTHM1
 *   u16      格式版本
 *   u16      flags（bit 0 = gzip）
 *   u32      解压后的 JSON 字节数
 *   u32      容器内数据字节数
 *   u32      解压后 JSON 的 CRC32
 *   bytes    gzip 或原始 UTF-8 JSON
 *
 * JSON 的 files 数组把默认主题和用户导入主题作为同一组主题文件保存。
 * 桌面端通过 preload 写到 Electron userData；浏览器/开发环境使用同格式的
 * base64 localStorage 回退，因此不会出现两套主题序列化逻辑。
 */

import { createSafeStorage } from "../../../shared/storage/safe-storage.js";
import { STORAGE_KEYS, THEME_ARCHIVE_FILENAME } from "../../../contracts/constants.js";
import { isValidThemeId, validateThemeDefinition } from "./contract.js";
import { normalizeRemovedIds } from "./seed.js";

export const THEME_ARCHIVE_KIND = "clawbox-theme-bundle";
const LEGACY_THEME_ARCHIVE_KIND = "tribblebook-theme-bundle";
export const THEME_ARCHIVE_VERSION = 3;
export const THEME_ARCHIVE_MAGIC = "PBOXTHM1";
export const THEME_ARCHIVE_MAX_BYTES = 2 * 1024 * 1024;
export const THEME_ARCHIVE_MAX_JSON_BYTES = 8 * 1024 * 1024;

/** 可解码的归档版本集合：v1（纯配置）、v2（配置 + 可选动效脚本）与 v3（+ 删除墓碑 removedIds）。 */
const SUPPORTED_ARCHIVE_VERSIONS = [1, 2, 3];

const HEADER_BYTES = 24;
const FLAG_GZIP = 1;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    value = CRC_TABLE[(value ^ bytes[index]) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return new Uint8Array(value);
  throw new Error("主题包数据类型无效");
}

function concatBytes(...chunks) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function readStreamBytes(stream, maxBytes = Number.POSITIVE_INFINITY) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = asBytes(result.value);
      total += chunk.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("主题包解压内容超过大小限制");
      }
      chunks.push(chunk);
    }
    return concatBytes(...chunks);
  } finally {
    reader.releaseLock();
  }
}

async function streamBytes(bytes, StreamClass, format, maxBytes = Number.POSITIVE_INFINITY) {
  if (typeof StreamClass !== "function" || typeof Blob !== "function" || typeof Response !== "function") {
    return null;
  }
  const blob = new Blob([bytes]);
  if (typeof blob.stream !== "function") return null;
  const stream = blob.stream().pipeThrough(new StreamClass(format));
  if (maxBytes !== Number.POSITIVE_INFINITY) return readStreamBytes(stream, maxBytes);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function compress(bytes) {
  if (typeof globalThis.CompressionStream !== "function") return { bytes, flags: 0 };
  const compressed = await streamBytes(bytes, globalThis.CompressionStream, "gzip");
  if (!compressed || compressed.length >= bytes.length) return { bytes, flags: 0 };
  return { bytes: compressed, flags: FLAG_GZIP };
}

async function decompress(bytes, flags, maxBytes) {
  if (!(flags & FLAG_GZIP)) return bytes;
  const decompressed = await streamBytes(bytes, globalThis.DecompressionStream, "gzip", maxBytes);
  if (!decompressed) throw new Error("当前环境不支持读取 gzip 主题包");
  return decompressed;
}

function assertPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("主题包载荷必须是对象");
  }
  if (![THEME_ARCHIVE_KIND, LEGACY_THEME_ARCHIVE_KIND].includes(payload.kind) || !SUPPORTED_ARCHIVE_VERSIONS.includes(payload.version)) {
    throw new Error("主题包版本不受支持");
  }
  if (!Array.isArray(payload.files) || payload.files.length > 64) {
    throw new Error("主题包 files 必须是最多 64 项的数组");
  }
  const seenIds = new Set();
  for (const file of payload.files) {
    if (!file || typeof file !== "object" || !isValidThemeId(file.id)) {
      throw new Error("主题包包含非法主题文件");
    }
    if (seenIds.has(file.id)) throw new Error(`主题包包含重复主题 ${file.id}`);
    seenIds.add(file.id);
    const expectedPath = `themes/${file.id}.theme.json`;
    if (file.path !== expectedPath || file.path.includes("\\") || file.path.includes("..")) {
      throw new Error("主题包包含不安全文件路径");
    }
    if (!file.definition || typeof file.definition !== "object" || Array.isArray(file.definition)) {
      throw new Error(`主题文件 ${file.id} 缺少定义`);
    }
    const definitionErrors = validateThemeDefinition(file.definition);
    if (definitionErrors.length) {
      throw new Error(`主题文件 ${file.id} 定义无效：${definitionErrors.join("；")}`);
    }
  }
  // 删除墓碑：旧版本档案没有该字段，补默认；非法值直接拒绝。
  payload.removedIds = normalizeRemovedIds(payload.removedIds);
  return payload;
}

/** 把主题文件清单编码为自定义主题包。 */
export async function encodeThemeArchive(payload) {
  const valid = assertPayload(payload);
  const rawBytes = encoder.encode(JSON.stringify(valid));
  if (rawBytes.length > THEME_ARCHIVE_MAX_JSON_BYTES) {
    throw new Error("主题包内容过大");
  }
  const packed = await compress(rawBytes);
  if (packed.bytes.length + HEADER_BYTES > THEME_ARCHIVE_MAX_BYTES) {
    throw new Error("主题包超过大小限制");
  }

  const header = new Uint8Array(HEADER_BYTES);
  header.set(encoder.encode(THEME_ARCHIVE_MAGIC), 0);
  const view = new DataView(header.buffer);
  view.setUint16(8, THEME_ARCHIVE_VERSION, true);
  view.setUint16(10, packed.flags, true);
  view.setUint32(12, rawBytes.length, true);
  view.setUint32(16, packed.bytes.length, true);
  view.setUint32(20, crc32(rawBytes), true);
  return concatBytes(header, packed.bytes);
}

/** 解析并校验自定义主题包。 */
export async function decodeThemeArchive(input) {
  const bytes = asBytes(input);
  if (bytes.length < HEADER_BYTES || bytes.length > THEME_ARCHIVE_MAX_BYTES) {
    throw new Error("主题包大小无效");
  }
  const magic = decoder.decode(bytes.subarray(0, 8));
  if (magic !== THEME_ARCHIVE_MAGIC) throw new Error("不是 ChenTako 主题包");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint16(8, true);
  if (!SUPPORTED_ARCHIVE_VERSIONS.includes(version)) throw new Error("主题包版本不受支持");
  if (version > THEME_ARCHIVE_VERSION) throw new Error("此主题包由更新版本的应用创建，请升级后导入");
  const flags = view.getUint16(10, true);
  if (flags & ~FLAG_GZIP) throw new Error("主题包压缩标记不受支持");
  const rawLength = view.getUint32(12, true);
  const storedLength = view.getUint32(16, true);
  const expectedCrc = view.getUint32(20, true);
  if (!rawLength || rawLength > THEME_ARCHIVE_MAX_JSON_BYTES || storedLength !== bytes.length - HEADER_BYTES) {
    throw new Error("主题包长度字段无效");
  }
  const packed = bytes.subarray(HEADER_BYTES);
  const rawBytes = await decompress(packed, flags, rawLength);
  if (rawBytes.length !== rawLength) throw new Error("主题包解压长度不匹配");
  if (crc32(rawBytes) !== expectedCrc) throw new Error("主题包校验失败");
  let payload = null;
  try {
    payload = JSON.parse(decoder.decode(rawBytes));
  } catch {
    throw new Error("主题包 JSON 解析失败");
  }
  return assertPayload(payload);
}

function bytesToBase64(bytes) {
  if (typeof btoa === "function") {
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  throw new Error("当前环境无法编码主题包");
}

function base64ToBytes(value) {
  if (typeof value !== "string" || !value) return null;
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(value, "base64"));
  throw new Error("当前环境无法读取主题包");
}

function desktopThemeArchiveApi() {
  return (globalThis.window?.["ai-chatbox"] ?? globalThis.window?.clawbox)?.themeArchive || null;
}

let desktopArchivePath = "";

/** 异步刷新桌面主题包路径（IPC 已无同步接口）；设置页展示前调用一次即可。 */
export async function refreshThemeArchiveLocation() {
  const api = desktopThemeArchiveApi();
  if (api && typeof api.getPath === "function") {
    try {
      desktopArchivePath = (await api.getPath()) || "";
    } catch {
      desktopArchivePath = "";
    }
  }
  return themeArchiveLocation();
}

/** 主题包的实际落点，用于设置页与诊断信息展示。 */
export function themeArchiveLocation() {
  const api = desktopThemeArchiveApi();
  if (api) {
    return desktopArchivePath || `Electron userData/${THEME_ARCHIVE_FILENAME}`;
  }
  return `localStorage:${STORAGE_KEYS.themeArchive}`;
}

/** 持久化适配器：Electron 文件优先，浏览器 localStorage 回退。 */
export function createThemeArchiveStore(safeStorage) {
  const storage = safeStorage || createSafeStorage();
  const api = desktopThemeArchiveApi();

  async function loadEncoded() {
    if (api && typeof api.load === "function") {
      const result = await api.load();
      const path = typeof result === "object" && result?.path ? result.path : "";
      if (path) desktopArchivePath = path;
      return {
        encoded: typeof result === "string" ? result : result?.data || "",
        location: path || themeArchiveLocation()
      };
    }
    return { encoded: storage.getItem(STORAGE_KEYS.themeArchive) || "", location: themeArchiveLocation() };
  }

  return {
    get location() { return themeArchiveLocation(); },
    async load() {
      const { encoded, location } = await loadEncoded();
      if (!encoded) return { payload: null, location };
      try {
        return { payload: await decodeThemeArchive(base64ToBytes(encoded)), location };
      } catch (error) {
        console.warn("[ChenTako Theme] 主题包读取失败，将尝试从旧主题存储恢复", error);
        return { payload: null, location, error };
      }
    },
    async save(payload) {
      const encoded = bytesToBase64(await encodeThemeArchive(payload));
      if (api && typeof api.save === "function") {
        const result = await api.save(encoded);
        const path = typeof result === "object" && result?.path ? result.path : "";
        if (path) desktopArchivePath = path;
        return path || themeArchiveLocation();
      }
      storage.setItem(STORAGE_KEYS.themeArchive, encoded);
      return themeArchiveLocation();
    },
    async remove() {
      if (api && typeof api.remove === "function") {
        await api.remove();
        return;
      }
      storage.removeItem(STORAGE_KEYS.themeArchive);
    }
  };
}
