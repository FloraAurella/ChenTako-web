import type { SseFrame } from "./protocol";

const FRAME_SEPARATOR = /\r\n\r\n|\n\n|\r\r/;

export function parseSseBlock(source: string): SseFrame | null {
  const block = String(source || "").replace(/^\uFEFF/, "");
  let event = "";
  const data: string[] = [];
  for (const line of block.split(/\r\n|\n|\r/)) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    const value = (colon < 0 ? "" : line.slice(colon + 1)).replace(/^ /, "");
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  if (!data.length) return null;
  return { event, data: data.join("\n") };
}

export function drainSseFrames(buffer: string, flush = false): { frames: SseFrame[]; rest: string } {
  const frames: SseFrame[] = [];
  let rest = buffer;
  let separator = FRAME_SEPARATOR.exec(rest);
  while (separator && separator.index !== undefined) {
    const end = separator.index + separator[0].length;
    const frame = parseSseBlock(rest.slice(0, end));
    if (frame) frames.push(frame);
    rest = rest.slice(end);
    separator = FRAME_SEPARATOR.exec(rest);
  }
  if (flush && rest.trim()) {
    const frame = parseSseBlock(rest);
    if (frame) frames.push(frame);
    rest = "";
  }
  return { frames, rest };
}

export interface ReadSseOptions {
  signal?: AbortSignal;
  onFrame: (frame: SseFrame) => void | Promise<void>;
}

export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  { signal, onFrame }: ReadSseOptions
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const abort = () => void reader.cancel(signal?.reason).catch(() => undefined);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
      const { done, value } = await reader.read();
      if (signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const drained = drainSseFrames(buffer);
      buffer = drained.rest;
      for (const frame of drained.frames) await onFrame(frame);
    }
    if (signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
    buffer += decoder.decode();
    const drained = drainSseFrames(buffer, true);
    for (const frame of drained.frames) await onFrame(frame);
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
