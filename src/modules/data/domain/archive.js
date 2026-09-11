"use strict";

/**
 * 自实现 ZIP（存储式，CRC32，手写二进制结构）：
 * 导出 conversation.json（clawbox-conversation v3，含会话内消息树）+ media/ 图片；
 * 导入含路径穿越防护与 CRC 校验，图片恢复为 data URL。
 */

import { EXPORT_ARCHIVE_KIND, EXPORT_ARCHIVE_VERSION, LIMITS, IMAGE_MIME_TYPES } from "../../../contracts/constants.js";
import { normalizeConversation, isSafeImageSource } from "../../../contracts/normalize.js";

// ---- CRC32 ----

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---- 二进制写入 ----

function dosDateTime(date) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time, day };
}

export function buildStoredZip(entries) {
  const encoder = new TextEncoder();
  const now = new Date();
  const { time, day } = dosDateTime(now);
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true); // UTF-8 文件名
    localView.setUint16(8, 0, true); // stored
    localView.setUint16(10, time, true);
    localView.setUint16(12, day, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    chunks.push(local, data);

    const centralEntry = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralEntry.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, day, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralEntry.set(nameBytes, 46);
    central.push(centralEntry);

    offset += local.length + data.length;
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  const totalSize = offset + centralSize + end.length;
  const zip = new Uint8Array(totalSize);
  let cursor = 0;
  for (const chunk of [...chunks, ...central, end]) {
    zip.set(chunk, cursor);
    cursor += chunk.length;
  }
  return zip;
}

// ---- ZIP 解析（存储式 + 路径穿越防护 + CRC 校验） ----

function readU16(view, offset) {
  return view.getUint16(offset, true);
}

function readU32(view, offset) {
  return view.getUint32(offset, true);
}

export function parseStoredZip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();

  if (bytes.length < 22) throw new Error("ZIP 文件过小，无法解析");
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65536; i -= 1) {
    if (readU32(view, i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("找不到 ZIP 结束记录");

  const entryCount = readU16(view, eocdOffset + 10);
  let centralOffset = readU32(view, eocdOffset + 16);
  const entries = [];

  for (let n = 0; n < entryCount; n += 1) {
    if (readU32(view, centralOffset) !== 0x02014b50) throw new Error("ZIP 中央目录损坏");
    const method = readU16(view, centralOffset + 10);
    if (method !== 0) throw new Error("仅支持存储式（stored）ZIP 条目");
    const crc = readU32(view, centralOffset + 16);
    const compressedSize = readU32(view, centralOffset + 20);
    const nameLength = readU16(view, centralOffset + 28);
    const extraLength = readU16(view, centralOffset + 30);
    const commentLength = readU16(view, centralOffset + 32);
    const localOffset = readU32(view, centralOffset + 42);
    const name = decoder.decode(bytes.subarray(centralOffset + 46, centralOffset + 46 + nameLength));

    if (name.startsWith("/") || name.includes("\\") || name.split("/").includes("..")) {
      throw new Error(`归档包含不安全路径：${name}`);
    }

    if (readU32(view, localOffset) !== 0x04034b50) throw new Error("ZIP 本地头损坏");
    const localNameLength = readU16(view, localOffset + 26);
    const localExtraLength = readU16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);
    if (data.length < compressedSize) throw new Error("ZIP 数据不完整");
    if (crc32(data) !== crc) throw new Error(`CRC 校验失败：${name}`);

    entries.push({ name, data: new Uint8Array(data) });
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

// ---- 会话归档导出 / 导入 ----

const EXT_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif"
};

function dataUrlToPart(source) {
  const match = String(source).match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase().replace("image/jpe", "image/jpeg");
  const base64 = match[2].replace(/\s/g, "");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return { mime, bytes, ext: Object.keys(EXT_MIME).find((ext) => EXT_MIME[ext] === mime) || "png" };
}

/** 导出为 .clawbox.zip 条目列表（conversation.json + media/*）。 */
export function exportConversationArchive(conversation) {
  const encoder = new TextEncoder();
  const media = [];
  let mediaIndex = 0;

  const exported = {
    kind: EXPORT_ARCHIVE_KIND,
    version: EXPORT_ARCHIVE_VERSION,
    exportedAt: Date.now(),
    conversation: {
      ...conversation,
      messages: (conversation.messages || []).map((message) => ({
        ...message,
        parts: (message.parts || []).map((part) => {
          if (part.type !== "image" || !String(part.source || "").startsWith("data:")) return part;
          const converted = dataUrlToPart(part.source);
          if (!converted) return part;
          mediaIndex += 1;
          const name = `media/${String(mediaIndex).padStart(4, "0")}.${converted.ext}`;
          media.push({ name, data: converted.bytes });
          return {
            type: "image",
            media: name,
            mimeType: part.mimeType || converted.mime,
            alt: part.alt || "图片"
          };
        })
      }))
    }
  };

  const entries = [
    { name: "conversation.json", data: encoder.encode(JSON.stringify(exported, null, 2)) },
    ...media
  ];
  return {
    entries,
    bytes: buildStoredZip(entries),
    filename: `${safeArchiveTitle(conversation.title)}.clawbox.zip`
  };
}

function safeArchiveTitle(title) {
  const cleaned = String(title || "对话").replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-").slice(0, 40);
  return cleaned || "对话";
}

function bytesToDataUrl(bytes, mime) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function restoreConversation(rawConversation, mediaMap) {
  const source = JSON.parse(JSON.stringify(rawConversation));
  source.messages = (source.messages || []).map((message) => {
    if (!Array.isArray(message.parts)) return message;
    message.parts = message.parts.map((part) => {
      if (part && part.type === "image" && part.media) {
        const mediaEntry = mediaMap.get(part.media);
        if (!mediaEntry) return { ...part, type: "unsupported", notice: `缺少媒体文件 ${part.media}` };
        const ext = String(part.media).split(".").pop().toLowerCase();
        const mime = IMAGE_MIME_TYPES.includes(part.mimeType) ? part.mimeType : (EXT_MIME[ext] || "image/png");
        return {
          type: "image",
          source: bytesToDataUrl(mediaEntry, mime),
          mimeType: mime,
          alt: part.alt || "图片"
        };
      }
      return part;
    });
    return message;
  });
  return source;
}

/** 兼容浏览器 File / jsdom File / 测试桩的读取辅助。 */
async function readFileBytes(file) {
  if (typeof file.arrayBuffer === "function") {
    return new Uint8Array(await file.arrayBuffer());
  }
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
      reader.readAsArrayBuffer(file);
    });
  }
  throw new Error("当前环境无法读取文件");
}

async function readFileText(file) {
  if (typeof file.text === "function") return file.text();
  const bytes = await readFileBytes(file);
  return new TextDecoder().decode(bytes);
}

/**
 * 导入 .clawbox.zip 或导出的 JSON 文件。
 * @returns {Promise<object>} 归一化后的会话（标题追加“（导入）”）
 */
export async function importConversationArchive(file, providers = []) {
  if (file.size > LIMITS.importBytes) {
    throw new Error(`导入文件不能超过 ${Math.floor(LIMITS.importBytes / 1024 / 1024)}MB`);
  }
  const name = String(file.name || "").toLowerCase();
  let payload = null;
  const mediaMap = new Map();

  if (name.endsWith(".zip")) {
    const entries = parseStoredZip(await readFileBytes(file));
    const jsonEntry = entries.find((entry) => entry.name === "conversation.json");
    if (!jsonEntry) throw new Error("归档缺少 conversation.json");
    for (const entry of entries) {
      if (entry.name.startsWith("media/") && entry.name.length > 6) {
        mediaMap.set(entry.name, entry.data);
      }
    }
    try {
      payload = JSON.parse(new TextDecoder().decode(jsonEntry.data));
    } catch {
      throw new Error("conversation.json 解析失败");
    }
    payload.conversation = restoreConversation(payload.conversation, mediaMap);
  } else {
    try {
      payload = JSON.parse(await readFileText(file));
    } catch {
      throw new Error("文件不是有效的 JSON 归档");
    }
    if (payload && payload.conversation && Array.isArray(payload.conversation.messages)) {
      payload = { ...payload, conversation: restoreConversation(payload.conversation, mediaMap) };
    }
  }

  const rawConversation = payload && payload.conversation && typeof payload.conversation === "object"
    ? payload.conversation
    : payload;

  const conversation = normalizeConversation(rawConversation);
  // 单段聊天归档不携带项目容器；跨设备导入不复用来源的项目 ID。
  conversation.projectId = null;
  conversation.title = `${conversation.title || "未命名对话"}（导入）`.slice(0, 120);
  conversation.imported = true;

  const matched = matchProvider(conversation, providers);
  if (matched) {
    conversation.providerId = matched.id;
  } else if (!conversation.providerSnapshot) {
    conversation.providerSnapshot = null;
  }

  // 图片来源安全检查（导入的数据 URL 已在归一化中过滤）
  conversation.messages.forEach((message) => {
    (message.parts || []).forEach((part) => {
      if (part.type === "image" && !isSafeImageSource(part.source)) {
        part.type = "unsupported";
        part.notice = "图片来源不受支持";
      }
    });
  });

  return conversation;
}

function matchProvider(conversation, providers) {
  if (conversation.providerId) {
    const byId = providers.find((provider) => provider.id === conversation.providerId);
    if (byId) return byId;
  }
  const snapshot = conversation.providerSnapshot;
  if (!snapshot) return null;
  return providers.find((provider) => (
    provider.displayName === snapshot.displayName &&
    provider.baseUrl.replace(/\/+$/, "") === String(snapshot.baseUrl || "").replace(/\/+$/, "")
  )) || null;
}
