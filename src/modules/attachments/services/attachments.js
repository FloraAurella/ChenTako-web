"use strict";

import {
  FILE_MIME_BY_EXTENSION,
  IMAGE_MIME_TYPES,
  LIMITS,
  TEXT_FILE_EXTENSIONS,
  TEXT_FILE_MIME_PREFIXES
} from "../../../contracts/constants.js";

function attachmentId() {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("读取失败"));
    reader.readAsDataURL(file);
  });
}

export function mimeForFile(file) {
  const type = String(file.type || "").split(";")[0].trim().toLowerCase();
  if (type) return type;
  const ext = (file.name || "").split(".").pop()?.toLowerCase() || "";
  return FILE_MIME_BY_EXTENSION[ext] || "application/octet-stream";
}

export function createAttachmentBudget(items) {
  return {
    fileBytes: items.filter((item) => item.kind === "file").reduce((sum, item) => sum + item.size, 0),
    imageCount: items.filter((item) => item.kind === "image").length,
    imageBytes: items.filter((item) => item.kind === "image").reduce((sum, item) => sum + item.size, 0),
    mediaCount: items.filter((item) => item.kind === "media").length,
    mediaBytes: items.filter((item) => item.kind === "media").reduce((sum, item) => sum + item.size, 0)
  };
}

export function createMessageAttachmentBudget(message) {
  return {
    fileBytes: (message.files || []).reduce((sum, file) => sum + file.text.length, 0),
    imageCount: (message.parts || []).filter((part) => part.type === "image").length,
    imageBytes: (message.parts || []).filter((part) => part.type === "image")
      .reduce((sum, part) => sum + Math.round((part.source || "").length * 0.75), 0),
    mediaCount: (message.parts || []).filter((part) => part.type === "file").length,
    mediaBytes: (message.parts || []).filter((part) => part.type === "file")
      .reduce((sum, part) => sum + (Number(part.size) > 0 ? Number(part.size) : Math.round((part.source || "").length * 0.75)), 0)
  };
}

/**
 * Reads browser File objects only after applying the existing per-message limits.
 * The caller owns UI state; this service reports user-facing validation failures
 * through the supplied notifier and never mutates the Store.
 */
export async function collectAttachmentItems(fileList, budget, notify) {
  const items = [];
  for (const file of [...fileList]) {
    if (!file.size) {
      notify(`「${file.name}」是空文件`, { tone: "danger" });
      continue;
    }
    const isImage = IMAGE_MIME_TYPES.includes(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    if (isImage) {
      if (budget.imageCount >= LIMITS.imagesPerMessage) {
        notify(`单条消息最多 ${LIMITS.imagesPerMessage} 张图片`, { tone: "danger" });
        continue;
      }
      if (file.size > LIMITS.imageBytes) {
        notify(`「${file.name}」超过 20MB 上限`, { tone: "danger" });
        continue;
      }
      if (budget.imageBytes + file.size > LIMITS.imagesTotalBytes) {
        notify("本条消息图片总量超过 80MB", { tone: "danger" });
        continue;
      }
      try {
        const source = await readAsDataUrl(file);
        budget.imageCount += 1;
        budget.imageBytes += file.size;
        items.push({ id: attachmentId(), kind: "image", name: file.name, source, mimeType: file.type || "image/png", size: file.size });
      } catch {
        notify(`「${file.name}」读取失败`, { tone: "danger" });
      }
      continue;
    }

    const ext = file.name.split(".").pop().toLowerCase();
    const isText = TEXT_FILE_EXTENSIONS.includes(ext) || TEXT_FILE_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix));
    if (isText) {
      if (file.size > LIMITS.attachmentBytes) {
        notify(`单个附件不能超过 5MB：「${file.name}」`, { tone: "danger" });
        continue;
      }
      if (budget.fileBytes + file.size > LIMITS.attachmentsTotalBytes) {
        notify("本次附件总量超过 15MB", { tone: "danger" });
        continue;
      }
      try {
        const text = await file.text();
        budget.fileBytes += file.size;
        items.push({ id: attachmentId(), kind: "file", name: file.name, text: text.slice(0, LIMITS.messageChars), size: file.size });
      } catch {
        notify(`「${file.name}」读取失败`, { tone: "danger" });
      }
      continue;
    }

    if (budget.mediaCount >= LIMITS.filesPerMessage) {
      notify(`单条消息最多 ${LIMITS.filesPerMessage} 个文件附件`, { tone: "danger" });
      continue;
    }
    if (file.size > LIMITS.fileBytes) {
      notify(`单个文件附件不能超过 20MB：「${file.name}」`, { tone: "danger" });
      continue;
    }
    if (budget.mediaBytes + file.size > LIMITS.filesTotalBytes) {
      notify("本条消息文件附件总量超过 80MB", { tone: "danger" });
      continue;
    }
    try {
      const source = await readAsDataUrl(file);
      budget.mediaCount += 1;
      budget.mediaBytes += file.size;
      items.push({ id: attachmentId(), kind: "media", name: file.name, source, mimeType: mimeForFile(file), size: file.size });
    } catch {
      notify(`「${file.name}」读取失败`, { tone: "danger" });
    }
  }
  return items;
}

export function dataUrlBlob(source, mimeType) {
  const comma = String(source).indexOf(",");
  if (comma < 0) throw new Error("不是合法的 data URL");
  const meta = String(source).slice(0, comma);
  const data = String(source).slice(comma + 1);
  const type = String(mimeType || "application/octet-stream").split(";")[0].trim() || "application/octet-stream";
  if (!/;base64/i.test(meta)) return new Blob([decodeURIComponent(data)], { type });
  const raw = atob(data.replace(/\s/g, ""));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return new Blob([bytes], { type });
}
