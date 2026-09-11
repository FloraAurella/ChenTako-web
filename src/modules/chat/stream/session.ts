import {
  decodeAppStreamEvent,
  type AppOutputFile,
  type AppOutputImage,
  type AppStreamEvent,
  type AppUsage,
  type ReasoningKind,
  type SseFrame,
  AppStreamProtocolError
} from "./protocol";

export type StreamStatus = "connecting" | "streaming" | "completed" | "failed" | "cancelled";
export type StreamPhase = "waiting" | "thinking" | "answering" | "completed";

export interface AppStreamState {
  status: StreamStatus;
  phase: StreamPhase;
  providerId: string;
  reasoningKind: ReasoningKind;
  reasoning: string;
  nativeReasoning: string;
  taggedReasoning: string;
  thinkTagState: { mode: "content" | "thinking"; buffer: string };
  format: string;
  content: string;
  images: AppOutputImage[];
  files: AppOutputFile[];
  skippedAttachments: Array<Record<string, unknown>>;
  toolEvents: Array<Record<string, unknown>>;
  usage: AppUsage | null;
  completed: boolean;
  stopped: boolean;
  error: string;
  finishReason: string;
  startedAt: number;
  reasoningStartedAt: number;
  contentStartedAt: number;
  completedAt: number;
}

export function createAppStreamState(format = "", now = Date.now()): AppStreamState {
  return {
    status: "connecting",
    // 建立请求或只收到协议 started 事件都不代表模型正在思考；只有真正的
    // reasoning 增量（含 <think> 兼容内容）到达后才进入 thinking。
    phase: "waiting",
    providerId: "",
    reasoningKind: format === "responses" ? "summary" : "thinking",
    reasoning: "",
    nativeReasoning: "",
    taggedReasoning: "",
    thinkTagState: { mode: "content", buffer: "" },
    format,
    content: "",
    images: [],
    files: [],
    skippedAttachments: [],
    toolEvents: [],
    usage: null,
    completed: false,
    stopped: false,
    error: "",
    finishReason: "",
    startedAt: now,
    reasoningStartedAt: 0,
    contentStartedAt: 0,
    completedAt: 0
  };
}

function combinedReasoning(nativeReasoning: string, taggedReasoning: string): string {
  const nativeTrimmed = nativeReasoning.trim();
  const taggedTrimmed = taggedReasoning.trim();
  if (!nativeTrimmed) return taggedReasoning;
  if (!taggedTrimmed) return nativeReasoning;
  if (nativeTrimmed === taggedTrimmed || nativeTrimmed.includes(taggedTrimmed)) return nativeReasoning;
  if (taggedTrimmed.includes(nativeTrimmed)) return taggedReasoning;
  return `${nativeReasoning}\n\n${taggedReasoning}`;
}

function tagPrefixAtEnd(value: string, tag: string): number {
  const lower = value.toLowerCase();
  for (let length = Math.min(lower.length, tag.length - 1); length > 0; length -= 1) {
    if (lower.endsWith(tag.slice(0, length))) return length;
  }
  return 0;
}

function appendThinkAwareContent(state: AppStreamState, delta: string, final = false): AppStreamState {
  const tagState = { ...state.thinkTagState, buffer: state.thinkTagState.buffer + delta };
  let content = state.content;
  let taggedReasoning = state.taggedReasoning;
  while (tagState.buffer) {
    const tag = tagState.mode === "thinking" ? "</think>" : "<think>";
    const index = tagState.buffer.toLowerCase().indexOf(tag);
    if (index >= 0) {
      const text = tagState.buffer.slice(0, index);
      if (tagState.mode === "thinking") taggedReasoning += text;
      else content += text;
      tagState.buffer = tagState.buffer.slice(index + tag.length);
      tagState.mode = tagState.mode === "thinking" ? "content" : "thinking";
      continue;
    }
    const keep = final ? 0 : tagPrefixAtEnd(tagState.buffer, tag);
    const text = tagState.buffer.slice(0, tagState.buffer.length - keep);
    if (tagState.mode === "thinking") taggedReasoning += text;
    else content += text;
    tagState.buffer = keep ? tagState.buffer.slice(-keep) : "";
    break;
  }
  if (final) {
    tagState.mode = "content";
    tagState.buffer = "";
  }
  return {
    ...state,
    content,
    taggedReasoning,
    reasoning: combinedReasoning(state.nativeReasoning, taggedReasoning),
    reasoningKind: !state.nativeReasoning && taggedReasoning ? "thinking" : state.reasoningKind,
    thinkTagState: tagState
  };
}

function appendUnique<T extends { source?: string }>(current: T[], incoming: T[], limit: number): T[] {
  const next = [...current];
  for (const item of incoming) {
    if (!item || !item.source || next.some((existing) => existing.source === item.source)) continue;
    next.push(item);
    if (next.length >= limit) break;
  }
  return next;
}

export function reduceAppStreamState(
  state: AppStreamState,
  event: AppStreamEvent,
  now = Date.now()
): AppStreamState {
  if (["completed", "failed", "cancelled"].includes(state.status)) return state;
  switch (event.type) {
    case "started":
      if (state.status !== "connecting") return state;
      return {
        ...state,
        status: "streaming",
        providerId: event.providerId,
        reasoningKind: event.reasoningKind,
        format: event.reasoningKind === "summary" ? "responses" : state.format
      };
    case "reasoning.delta":
      return {
        ...state,
        status: "streaming",
        phase: state.phase === "answering" || !event.delta ? state.phase : "thinking",
        reasoningStartedAt: event.delta ? (state.reasoningStartedAt || now) : state.reasoningStartedAt,
        nativeReasoning: state.nativeReasoning + event.delta,
        reasoning: combinedReasoning(state.nativeReasoning + event.delta, state.taggedReasoning),
        reasoningKind: event.kind
      };
    case "content.delta": {
      const next = appendThinkAwareContent(state, event.delta);
      return {
        ...next,
        status: "streaming",
        phase: next.content ? "answering" : next.reasoning ? "thinking" : state.phase,
        reasoningStartedAt: next.reasoning ? (state.reasoningStartedAt || now) : state.reasoningStartedAt,
        contentStartedAt: next.content ? (state.contentStartedAt || now) : state.contentStartedAt
      };
    }
    case "output":
      return {
        ...state,
        images: appendUnique(state.images, event.images, 4),
        files: appendUnique(state.files, event.files, 8)
      };
    case "extension":
      return state.toolEvents.length >= 48 ? state : {
        ...state,
        // 浏览器按实际到达顺序记录展示锚点；不信任后端传入的同名字段。
        toolEvents: [...state.toolEvents, { ...event.value, contentOffset: state.content.length }]
      };
    case "attachments.skipped":
      return { ...state, skippedAttachments: event.items.slice(0, 8) };
    case "usage":
      return { ...state, usage: event.usage };
    case "completed": {
      const flushed = appendThinkAwareContent(state, "", true);
      return {
        ...flushed,
        status: "completed",
        phase: "completed",
        completed: true,
        finishReason: event.finishReason,
        completedAt: now
      };
    }
    case "error":
      return {
        ...appendThinkAwareContent(state, "", true),
        status: "failed",
        phase: "completed",
        completed: true,
        error: event.message,
        completedAt: now
      };
  }
}

export function cancelAppStreamState(state: AppStreamState, now = Date.now()): AppStreamState {
  if (["completed", "failed", "cancelled"].includes(state.status)) return state;
  return {
    ...appendThinkAwareContent(state, "", true),
    status: "cancelled",
    phase: "completed",
    completed: true,
    stopped: true,
    completedAt: now
  };
}

export function finalizeAppStreamState(state: AppStreamState, now = Date.now()): AppStreamState {
  if (["completed", "failed", "cancelled"].includes(state.status)) return state;
  return {
    ...appendThinkAwareContent(state, "", true),
    status: "completed",
    phase: "completed",
    completed: true,
    completedAt: now
  };
}

export function consumeAppStreamFrame(state: AppStreamState, frame: SseFrame, now = Date.now()): AppStreamState {
  const event = decodeAppStreamEvent(frame);
  if (["completed", "failed", "cancelled"].includes(state.status)) {
    throw new AppStreamProtocolError("流终态之后收到非法业务事件");
  }
  if (state.status === "connecting" && event.type !== "started") {
    throw new AppStreamProtocolError("chat.stream.started 必须是成功流的第一条事件");
  }
  if (state.status !== "connecting" && event.type === "started") {
    throw new AppStreamProtocolError("chat.stream.started 只能发送一次");
  }
  return reduceAppStreamState(state, event, now);
}
