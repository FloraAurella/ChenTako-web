export const APP_STREAM_VERSION = 1 as const;

export const APP_STREAM_EVENTS = {
  started: "chat.stream.started",
  reasoningDelta: "chat.reasoning.delta",
  contentDelta: "chat.content.delta",
  output: "chat.output",
  extension: "chat.extension",
  attachmentsSkipped: "chat.attachments.skipped",
  usage: "chat.usage",
  completed: "chat.stream.completed",
  error: "chat.stream.error"
} as const;

export type ReasoningKind = "thinking" | "summary";

export interface AppUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimated: boolean;
}

export interface AppOutputImage {
  source: string;
  mimeType?: string;
  alt?: string;
}

export interface AppOutputFile {
  source: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

export type AppStreamEvent =
  | { type: "started"; version: 1; providerId: string; reasoningKind: ReasoningKind }
  | { type: "reasoning.delta"; delta: string; kind: ReasoningKind }
  | { type: "content.delta"; delta: string }
  | { type: "output"; images: AppOutputImage[]; files: AppOutputFile[] }
  | { type: "extension"; value: Record<string, unknown> }
  | { type: "attachments.skipped"; items: Array<Record<string, unknown>> }
  | { type: "usage"; usage: AppUsage }
  | { type: "completed"; finishReason: string }
  | { type: "error"; message: string };

export interface SseFrame {
  event: string;
  data: string;
}

export class AppStreamProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppStreamProtocolError";
  }
}

function recordOf(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppStreamProtocolError(`${label} 必须是 JSON 对象`);
  }
  return value as Record<string, unknown>;
}

function textOf(value: unknown, label: string, optional = false): string {
  if (optional && value === undefined) return "";
  if (typeof value !== "string") throw new AppStreamProtocolError(`${label} 必须是字符串`);
  return value;
}

function reasoningKindOf(value: unknown): ReasoningKind {
  if (value === "summary") return "summary";
  if (value === "thinking" || value === undefined) return "thinking";
  throw new AppStreamProtocolError("reasoningKind 必须是 thinking 或 summary");
}

function usageOf(value: unknown): AppUsage {
  const payload = recordOf(value, "usage");
  const numberOf = (key: string): number => {
    const parsed = Number(payload[key] ?? 0);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AppStreamProtocolError(`usage.${key} 必须是非负数字`);
    }
    return parsed;
  };
  const inputTokens = numberOf("inputTokens");
  const outputTokens = numberOf("outputTokens");
  return {
    inputTokens,
    outputTokens,
    totalTokens: Math.max(numberOf("totalTokens"), inputTokens + outputTokens),
    estimated: payload.estimated === true
  };
}

function arrayOfRecords(value: unknown, label: string): Array<Record<string, unknown>> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new AppStreamProtocolError(`${label} 必须是数组`);
  return value.map((entry, index) => recordOf(entry, `${label}[${index}]`));
}

export function decodeAppStreamEvent(frame: SseFrame): AppStreamEvent {
  let value: unknown;
  try {
    value = JSON.parse(frame.data);
  } catch {
    throw new AppStreamProtocolError(`${frame.event || "未命名事件"} 的 data 不是合法 JSON`);
  }
  const payload = recordOf(value, frame.event || "SSE data");

  switch (frame.event) {
    case APP_STREAM_EVENTS.started: {
      const version = Number(payload.version);
      if (version !== APP_STREAM_VERSION) {
        throw new AppStreamProtocolError(`不支持的流协议版本：${String(payload.version)}`);
      }
      return {
        type: "started",
        version: APP_STREAM_VERSION,
        providerId: textOf(payload.providerId, "providerId", true),
        reasoningKind: reasoningKindOf(payload.reasoningKind)
      };
    }
    case APP_STREAM_EVENTS.reasoningDelta:
      return {
        type: "reasoning.delta",
        delta: textOf(payload.delta, "delta"),
        kind: reasoningKindOf(payload.kind)
      };
    case APP_STREAM_EVENTS.contentDelta:
      return { type: "content.delta", delta: textOf(payload.delta, "delta") };
    case APP_STREAM_EVENTS.output:
      return {
        type: "output",
        images: arrayOfRecords(payload.images, "images") as unknown as AppOutputImage[],
        files: arrayOfRecords(payload.files, "files") as unknown as AppOutputFile[]
      };
    case APP_STREAM_EVENTS.extension:
      return { type: "extension", value: payload };
    case APP_STREAM_EVENTS.attachmentsSkipped:
      return { type: "attachments.skipped", items: arrayOfRecords(payload.items, "items") };
    case APP_STREAM_EVENTS.usage:
      return { type: "usage", usage: usageOf(payload) };
    case APP_STREAM_EVENTS.completed:
      return { type: "completed", finishReason: textOf(payload.finishReason, "finishReason", true) };
    case APP_STREAM_EVENTS.error:
      return { type: "error", message: textOf(payload.message, "message") };
    default:
      throw new AppStreamProtocolError(`未知的流事件：${frame.event || "(empty)"}`);
  }
}
