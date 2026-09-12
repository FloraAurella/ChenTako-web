/**
 * 上游 SSE 读取（原版 lib/sse.ts 移植）：按规范拆出完整事件以处理任意网络
 * 分片；UTF-8 解码器保留跨 chunk 字符状态；EOF 前缺空行的兼容网关补全帧。
 */
export interface UpstreamSseFrame {
  event: string;
  data: string;
  raw: string;
  hasData: boolean;
}

const MAX_SSE_FRAME_CHARS = 40 * 1024 * 1024;

export function parseSseBlock(raw: string): UpstreamSseFrame {
  const block = String(raw || '').replace(/^\uFEFF/, '');
  let event = '';
  let hasData = false;
  const dataLines: string[] = [];
  for (const line of block.split(/\r\n|\n|\r/)) {
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    if (field === 'data') {
      hasData = true;
      dataLines.push(value);
    }
  }
  return { event, data: dataLines.join('\n'), raw, hasData };
}

export async function readUpstreamSse(
  upstreamBody: ReadableStream<Uint8Array> | null | undefined,
  onFrame: (frame: UpstreamSseFrame) => void | Promise<void>
): Promise<void> {
  if (!upstreamBody || typeof upstreamBody.getReader !== 'function') {
    throw new Error('上游响应缺少可读流');
  }
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const drainFrames = async (final = false): Promise<void> => {
    let separator = buffer.match(/\r\n\r\n|\n\n|\r\r/);
    while (separator && separator.index !== undefined) {
      const end = separator.index + separator[0].length;
      const raw = buffer.slice(0, end);
      buffer = buffer.slice(end);
      await onFrame(parseSseBlock(raw));
      separator = buffer.match(/\r\n\r\n|\n\n|\r\r/);
    }
    if (buffer.length > MAX_SSE_FRAME_CHARS) {
      throw new Error('上游 SSE 单帧超过 40MB 限制');
    }
    if (final && buffer) {
      const raw = `${buffer}\n\n`;
      buffer = '';
      await onFrame(parseSseBlock(raw));
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || !value.byteLength) continue;
      buffer += decoder.decode(value, { stream: true });
      await drainFrames();
    }
    buffer += decoder.decode();
    await drainFrames(true);
  } finally {
    reader.releaseLock();
  }
}
