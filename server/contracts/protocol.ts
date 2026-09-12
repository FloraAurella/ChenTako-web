/**
 * 应用层流协议 v1：事件名与载荷必须与
 * src/modules/chat/stream/protocol.ts（前端解码端）保持一致。
 * test/server/contracts-sync.test.ts 导入前端协议常量做相等断言。
 */
export const APP_STREAM_VERSION = 1 as const;

export const APP_STREAM_EVENTS = {
  started: 'chat.stream.started',
  reasoningDelta: 'chat.reasoning.delta',
  contentDelta: 'chat.content.delta',
  output: 'chat.output',
  extension: 'chat.extension',
  attachmentsSkipped: 'chat.attachments.skipped',
  usage: 'chat.usage',
  completed: 'chat.stream.completed',
  error: 'chat.stream.error'
} as const;

export type ReasoningKind = 'thinking' | 'summary';

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

export interface SkippedAttachment {
  name: string;
  mimeType: string;
  reason: string;
}

/** 非流式 JSON 响应（与前端 normalizeProviderResponse 对齐）。 */
export interface NormalizedResponse {
  reasoning: string;
  content: string;
  images: AppOutputImage[];
  files: AppOutputFile[];
  reasoningKind: ReasoningKind;
  usage: (AppUsage & { source?: string }) | null;
}
