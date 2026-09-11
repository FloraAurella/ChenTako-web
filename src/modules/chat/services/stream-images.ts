export interface StreamImageItem {
  source: string;
  alt?: string;
}

interface StreamImageOptions {
  entry: Element;
  messageId: string;
  images: StreamImageItem[];
  onCommit?: () => void;
}

const slotSources = new WeakMap<HTMLElement, string>();
const slotDecodes = new WeakMap<HTMLElement, Promise<void>>();

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** React 消息节点首次提交时使用的确定性等待槽，避免控制器挂载后又被首轮提交覆盖。 */
export function imageGenerationSlotHtml(messageId: string): string {
  const safeId = escapeAttribute(messageId);
  return `<div class="message-images stream-message-images" data-stream-images="true"><button type="button" class="message-image stream-image-slot is-pending" data-message-id="${safeId}" data-image-index="0" aria-label="图片生成中" disabled><span class="image-generation-placeholder" role="status" aria-live="polite"><span class="image-generation-glow" aria-hidden="true"></span><span class="image-generation-label">正在生成图片</span></span></button></div>`;
}

function createPlaceholder(): HTMLSpanElement {
  const placeholder = document.createElement("span");
  placeholder.className = "image-generation-placeholder";
  placeholder.setAttribute("role", "status");
  placeholder.setAttribute("aria-live", "polite");

  const glow = document.createElement("span");
  glow.className = "image-generation-glow";
  glow.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "image-generation-label";
  label.textContent = "正在生成图片";

  placeholder.append(glow, label);
  return placeholder;
}

function createSlot(messageId: string, imageIndex: number): HTMLButtonElement {
  const slot = document.createElement("button");
  slot.type = "button";
  slot.className = "message-image stream-image-slot is-pending";
  slot.dataset.messageId = messageId;
  slot.dataset.imageIndex = String(imageIndex);
  slot.setAttribute("aria-label", "图片生成中");
  slot.disabled = true;
  slot.append(createPlaceholder());
  return slot;
}

function imageRegion(entry: Element): HTMLElement | null {
  const body = entry.querySelector(":scope > .message-body");
  if (!(body instanceof HTMLElement)) return null;
  const existing = body.querySelector(":scope > .message-images[data-stream-images]");
  if (existing instanceof HTMLElement) return existing;
  const region = document.createElement("div");
  region.className = "message-images stream-message-images";
  region.setAttribute("data-stream-images", "true");
  body.append(region);
  return region;
}

function ensureSlot(region: HTMLElement, messageId: string, imageIndex: number): HTMLButtonElement {
  const existing = region.querySelector(`:scope > .stream-image-slot[data-image-index="${imageIndex}"]`);
  if (existing instanceof HTMLButtonElement) return existing;
  const slot = createSlot(messageId, imageIndex);
  region.append(slot);
  return slot;
}

function waitForImage(img: HTMLImageElement): Promise<void> {
  if (img.complete) {
    return img.naturalWidth > 0 ? Promise.resolve() : Promise.reject(new Error("图片解码失败"));
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("图片加载失败"));
    };
    img.addEventListener("load", onLoad, { once: true });
    img.addEventListener("error", onError, { once: true });
    if (typeof img.decode === "function") {
      void img.decode().then(onLoad, () => {
        if (img.complete) onError();
      });
    }
  });
}

/** 为确定具备出图能力的模型立即挂载一个 1:1、不可交互的临时等待槽。 */
export function mountImageGenerationSlot(entry: Element, messageId: string): HTMLElement | null {
  const region = imageRegion(entry);
  if (!region) return null;
  ensureSlot(region, messageId, 0);
  return region;
}

/**
 * 将已通过 normalizeOutputImages 白名单校验的流式图片原位写入等待槽。
 * 图片解码成功前保留等待画面，失败时保留可诊断状态；临时状态不会进入持久化模型。
 */
export function paintStreamImages({ entry, messageId, images, onCommit }: StreamImageOptions): Promise<void> {
  if (!images.length) return Promise.resolve();
  const region = imageRegion(entry);
  if (!region) return Promise.resolve();

  const tasks = images.map((image, imageIndex) => {
    const slot = ensureSlot(region, messageId, imageIndex);
    if (slotSources.get(slot) === image.source) return slotDecodes.get(slot) || Promise.resolve();

    slotSources.set(slot, image.source);
    slot.classList.remove("is-failed", "is-ready");
    slot.classList.add("is-pending", "is-decoding");
    slot.disabled = true;
    slot.setAttribute("aria-label", "图片加载中");

    slot.querySelector(":scope > img")?.remove();
    const img = document.createElement("img");
    img.className = "stream-image-result";
    img.alt = image.alt || "模型生成的图片";
    img.loading = "eager";
    img.decoding = "async";
    img.src = image.source;
    slot.append(img);

    const decode = waitForImage(img).then(() => {
      if (!slot.isConnected || slotSources.get(slot) !== image.source) return;
      slot.classList.remove("is-pending", "is-decoding", "is-failed");
      slot.classList.add("is-ready");
      slot.disabled = false;
      slot.setAttribute("aria-label", "放大图片");
      slot.querySelector(".image-generation-placeholder")?.setAttribute("aria-hidden", "true");
      onCommit?.();
    }).catch(() => {
      if (!slot.isConnected || slotSources.get(slot) !== image.source) return;
      slot.classList.remove("is-decoding");
      slot.classList.add("is-failed");
      const label = slot.querySelector(".image-generation-label");
      if (label) label.textContent = "图片加载失败";
      slot.setAttribute("aria-label", "图片加载失败");
      onCommit?.();
    });
    slotDecodes.set(slot, decode);
    onCommit?.();
    return decode;
  });

  return Promise.all(tasks).then(() => undefined);
}
