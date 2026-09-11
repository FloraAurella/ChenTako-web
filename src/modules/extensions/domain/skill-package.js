"use strict";

/**
 * Skill 导入器：把单个 Markdown 或普通 ZIP 中的 Markdown 文件转换成
 * 声明性的 Skill。ZIP 只接受 stored / deflate 两种常见方式，并在解压前后
 * 都限制大小、条目数量与路径，避免把 Skill 导入变成一个压缩炸弹入口。
 */

import { crc32 } from "../../data/public/domain_archive.js";

const MAX_PACKAGE_BYTES = 5 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 32;
const MAX_UNCOMPRESSED_BYTES = 512 * 1024;
const MAX_SKILL_BYTES = 16 * 1024;
const MAX_NAME_CHARS = 80;
const MAX_DESCRIPTION_CHARS = 600;
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(value || []);
}

function readU16(view, offset) {
  return view.getUint16(offset, true);
}

function readU32(view, offset) {
  return view.getUint32(offset, true);
}

function ensureRange(bytes, offset, length, message) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > bytes.length) {
    throw new Error(message);
  }
}

function decodeUtf8(bytes, message) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(message);
  }
}

function safeArchivePath(name) {
  const value = String(name || "");
  if (!value || value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
  return !value.split("/").includes("..");
}

async function inflateRaw(bytes, maximum) {
  if (typeof DecompressionStream !== "function" || typeof ReadableStream !== "function") {
    throw new Error("当前环境不支持读取压缩 Skill 包；请使用最新版 Clawbox");
  }
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
  const stream = source.pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = asBytes(result.value);
      total += chunk.byteLength;
      if (total > maximum) {
        await reader.cancel();
        throw new Error(`Skill 压缩包解压后超过 ${Math.floor(maximum / 1024)}KB`);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return output;
}

/** 读取 stored / deflate ZIP，返回安全的普通文件条目。 */
export async function parseSkillZip(input) {
  const bytes = asBytes(input);
  if (bytes.byteLength > MAX_PACKAGE_BYTES) {
    throw new Error(`Skill 压缩包不能超过 ${Math.floor(MAX_PACKAGE_BYTES / 1024 / 1024)}MB`);
  }
  if (bytes.byteLength < 22) throw new Error("Skill 压缩包过小，无法解析");

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocdOffset = -1;
  const searchStart = Math.max(0, bytes.length - 22 - 65536);
  for (let offset = bytes.length - 22; offset >= searchStart; offset -= 1) {
    if (readU32(view, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("找不到 Skill 压缩包结束记录");

  const diskNumber = readU16(view, eocdOffset + 4);
  const centralDisk = readU16(view, eocdOffset + 6);
  const entryCount = readU16(view, eocdOffset + 10);
  const centralSize = readU32(view, eocdOffset + 12);
  const centralOffset = readU32(view, eocdOffset + 16);
  if (diskNumber !== 0 || centralDisk !== 0 || entryCount > MAX_ZIP_ENTRIES) {
    throw new Error("Skill 压缩包格式或条目数量不受支持");
  }
  ensureRange(bytes, centralOffset, centralSize, "Skill 压缩包中央目录损坏");

  const entries = [];
  let totalBytes = 0;
  let cursor = centralOffset;
  const centralEnd = centralOffset + centralSize;
  for (let index = 0; index < entryCount; index += 1) {
    ensureRange(bytes, cursor, 46, "Skill 压缩包中央目录不完整");
    if (readU32(view, cursor) !== 0x02014b50) throw new Error("Skill 压缩包中央目录损坏");
    const flags = readU16(view, cursor + 8);
    const method = readU16(view, cursor + 10);
    const crc = readU32(view, cursor + 16);
    const compressedSize = readU32(view, cursor + 20);
    const uncompressedSize = readU32(view, cursor + 24);
    const nameLength = readU16(view, cursor + 28);
    const extraLength = readU16(view, cursor + 30);
    const commentLength = readU16(view, cursor + 32);
    const externalAttributes = readU32(view, cursor + 38);
    const localOffset = readU32(view, cursor + 42);
    const recordLength = 46 + nameLength + extraLength + commentLength;
    ensureRange(bytes, cursor, recordLength, "Skill 压缩包条目记录不完整");
    if (cursor + recordLength > centralEnd) throw new Error("Skill 压缩包中央目录越界");

    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = decodeUtf8(nameBytes, "Skill 压缩包包含无法读取的文件名");
    if (!safeArchivePath(name)) throw new Error(`Skill 压缩包包含不安全路径：${name}`);
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    if ((unixMode & 0xf000) === 0xa000) throw new Error(`Skill 压缩包禁止符号链接：${name}`);

    // 目录和非 Markdown 文件不参与 Skill 导入，但仍计入条目上限。
    const extension = name.toLowerCase().endsWith("/") ? "" : name.slice(name.lastIndexOf(".")).toLowerCase();
    if (name.endsWith("/")) {
      cursor += recordLength;
      continue;
    }
    if (flags & 0x0001) throw new Error(`Skill 压缩包包含加密条目：${name}`);
    if (method !== 0 && method !== 8) throw new Error(`Skill 压缩包使用不支持的压缩方式：${name}`);
    if (uncompressedSize > MAX_UNCOMPRESSED_BYTES || compressedSize > MAX_PACKAGE_BYTES) {
      throw new Error(`Skill 压缩包条目过大：${name}`);
    }

    ensureRange(bytes, localOffset, 30, `Skill 压缩包本地条目损坏：${name}`);
    if (readU32(view, localOffset) !== 0x04034b50) throw new Error(`Skill 压缩包本地条目损坏：${name}`);
    const localNameLength = readU16(view, localOffset + 26);
    const localExtraLength = readU16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    ensureRange(bytes, dataStart, compressedSize, `Skill 压缩包数据不完整：${name}`);
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? new Uint8Array(compressed) : await inflateRaw(compressed, MAX_UNCOMPRESSED_BYTES);
    if (data.byteLength !== uncompressedSize) throw new Error(`Skill 压缩包大小校验失败：${name}`);
    if (crc32(data) !== crc) throw new Error(`Skill 压缩包 CRC 校验失败：${name}`);
    totalBytes += data.byteLength;
    if (totalBytes > MAX_UNCOMPRESSED_BYTES) throw new Error("Skill 压缩包解压内容过大");
    if (MARKDOWN_EXTENSIONS.has(extension)) entries.push({ name, data });
    cursor += recordLength;
  }

  if (!entries.length) throw new Error("Skill 压缩包中没有 .md 文件");
  return entries;
}

function cleanMetadataValue(value, max) {
  return String(value || "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
}

function parseFrontMatter(source) {
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) return { metadata: {}, body: source };
  const lines = source.split("\n");
  const closing = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)\s*$/.test(line.trim()));
  if (closing < 0) return { metadata: {}, body: source };
  const metadata = {};
  for (const line of lines.slice(1, closing)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]{0,40})\s*:\s*(.*?)\s*$/);
    if (match) metadata[match[1].toLowerCase()] = cleanMetadataValue(match[2], MAX_DESCRIPTION_CHARS);
  }
  return { metadata, body: lines.slice(closing + 1).join("\n") };
}

function markdownPlainText(value) {
  return String(value || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~>#]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function fallbackName(fileName) {
  const baseName = String(fileName || "Skill").split("/").pop() || "Skill";
  return cleanMetadataValue(baseName.replace(/\.(?:markdown|md)$/i, ""), MAX_NAME_CHARS) || "未命名 Skill";
}

/** 把 Markdown 文本转换成可写入 extensions.skills 的声明。 */
export function parseSkillMarkdownText(text, fileName = "skill.md") {
  const source = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!source.trim()) throw new Error(`Skill 文件为空：${fileName}`);
  if (new TextEncoder().encode(source).byteLength > MAX_SKILL_BYTES) {
    throw new Error(`Skill 文件不能超过 ${Math.floor(MAX_SKILL_BYTES / 1024)}KB：${fileName}`);
  }
  const { metadata, body: rawBody } = parseFrontMatter(source);
  const body = rawBody.trim();
  if (!body) throw new Error(`Skill 文件没有正文：${fileName}`);
  const heading = body.match(/^#{1,6}\s+(.+?)\s*#*\s*$/m);
  const firstParagraph = body.split("\n").map((line) => line.trim()).find((line) => line && !/^#{1,6}\s+/.test(line)) || "";
  const name = cleanMetadataValue(metadata.name, MAX_NAME_CHARS) || cleanMetadataValue(heading?.[1], MAX_NAME_CHARS) || fallbackName(fileName);
  const description = cleanMetadataValue(metadata.description, MAX_DESCRIPTION_CHARS) || markdownPlainText(firstParagraph).slice(0, MAX_DESCRIPTION_CHARS) || `${name} 的可复用任务指令`;
  return { name, description, instructions: body, sourceFile: String(fileName || "skill.md") };
}

export async function parseSkillMarkdownFile(file) {
  const name = String(file?.name || "skill.md");
  if (!MARKDOWN_EXTENSIONS.has(name.slice(name.lastIndexOf(".")).toLowerCase())) {
    throw new Error(`只支持 .md 或 .markdown 文件：${name}`);
  }
  if (Number(file?.size) > MAX_SKILL_BYTES) throw new Error(`Skill 文件不能超过 16KB：${name}`);
  const bytes = asBytes(await file.arrayBuffer());
  return parseSkillMarkdownText(decodeUtf8(bytes, `Skill 文件不是有效 UTF-8：${name}`), name);
}

export async function parseSkillPackageFile(file) {
  const name = String(file?.name || "skills.zip");
  if (Number(file?.size) > MAX_PACKAGE_BYTES) throw new Error("Skill 压缩包不能超过 5MB");
  const entries = await parseSkillZip(await file.arrayBuffer());
  return entries.map((entry) => parseSkillMarkdownText(decodeUtf8(entry.data, `Skill 文件不是有效 UTF-8：${entry.name}`), entry.name));
}

export const SKILL_IMPORT_LIMITS = Object.freeze({
  packageBytes: MAX_PACKAGE_BYTES,
  skillBytes: MAX_SKILL_BYTES,
  packageEntries: MAX_ZIP_ENTRIES,
  uncompressedBytes: MAX_UNCOMPRESSED_BYTES
});
