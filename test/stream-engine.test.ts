import { describe, expect, test, vi } from "vitest";
import {
  APP_STREAM_EVENTS,
  AppStreamProtocolError,
  consumeAppStreamFrame,
  createAppStreamState,
  createStreamRegistry,
  createStreamScheduler,
  decodeAppStreamEvent,
  drainSseFrames,
  readSseStream,
  reduceAppStreamState,
  cancelAppStreamState,
  finalizeAppStreamState
} from "../src/modules/chat/stream/index";

function event(name: string, value: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`;
}

function splitBytes(bytes: Uint8Array, seed: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  let offset = 0;
  let value = seed || 1;
  while (offset < bytes.length) {
    value = (value * 48271) % 0x7fffffff;
    const length = Math.max(1, value % 19);
    chunks.push(bytes.slice(offset, offset + length));
    offset += length;
  }
  return chunks;
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    }
  });
}

describe("SSE transport", () => {
  test("支持 BOM、CRLF、多行 data 与 EOF 缺少空行", () => {
    const source = '\uFEFFevent: chat.content.delta\r\ndata: {"delta":"a"}\r\n\r\nevent: x\ndata: one\ndata: two';
    const result = drainSseFrames(source, true);
    expect(result.frames).toEqual([
      { event: "chat.content.delta", data: '{"delta":"a"}' },
      { event: "x", data: "one\ntwo" }
    ]);
    expect(result.rest).toBe("");
  });

  test("500 种任意 UTF-8 分片得到同一事件序列", async () => {
    const source = [
      event(APP_STREAM_EVENTS.started, { version: 1, providerId: "p", reasoningKind: "thinking" }),
      event(APP_STREAM_EVENTS.reasoningDelta, { delta: "先想🤔", kind: "thinking" }),
      event(APP_STREAM_EVENTS.contentDelta, { delta: "你好，世界🌊" }),
      event(APP_STREAM_EVENTS.completed, { finishReason: "stop" })
    ].join("");
    const bytes = new TextEncoder().encode(source);
    const expected = ["started", "reasoning.delta", "content.delta", "completed"];
    for (let seed = 1; seed <= 500; seed += 1) {
      const result: string[] = [];
      await readSseStream(streamOf(splitBytes(bytes, seed)), {
        onFrame(frame) { result.push(decodeAppStreamEvent(frame).type); }
      });
      expect(result).toEqual(expected);
    }
  });

  test("Abort 立即停止读取且不刷新未完成事件", async () => {
    const controller = new AbortController();
    const frames: string[] = [];
    const stream = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(new TextEncoder().encode('event: chat.content.delta\ndata: {"delta":"不应提交"}'));
      },
      cancel() {}
    });
    const reading = readSseStream(stream, {
      signal: controller.signal,
      onFrame(frame) { frames.push(frame.event); }
    });
    controller.abort();
    await expect(reading).rejects.toMatchObject({ name: "AbortError" });
    expect(frames).toEqual([]);
  });
});

describe("App stream protocol and reducer", () => {
  test("发送后保持等待态，直到真实 reasoning 或正文增量到达", () => {
    const initial = createAppStreamState();
    expect(initial.phase).toBe("waiting");

    const started = reduceAppStreamState(initial, {
      type: "started",
      version: 1,
      providerId: "p",
      reasoningKind: "thinking"
    });
    expect(started.phase).toBe("waiting");
    expect(started.reasoning).toBe("");

    const thinking = reduceAppStreamState(started, {
      type: "reasoning.delta",
      delta: "开始推理",
      kind: "thinking"
    }, 25);
    expect(thinking.phase).toBe("thinking");
    expect(thinking.reasoningStartedAt).toBe(25);

    const directAnswer = reduceAppStreamState(started, {
      type: "content.delta",
      delta: "直接回答"
    });
    expect(directAnswer.phase).toBe("answering");
    expect(directAnswer.reasoning).toBe("");
  });

  test("拒绝未知版本、未知事件和非 JSON data", () => {
    expect(() => decodeAppStreamEvent({ event: APP_STREAM_EVENTS.started, data: '{"version":2}' }))
      .toThrow(AppStreamProtocolError);
    expect(() => decodeAppStreamEvent({ event: "provider.raw", data: "{}" }))
      .toThrow(/未知的流事件/);
    expect(() => decodeAppStreamEvent({ event: APP_STREAM_EVENTS.contentDelta, data: "{" }))
      .toThrow(/不是合法 JSON/);
  });

  test("累积正文、思考、输出、用量并锁定终态", () => {
    let state = createAppStreamState();
    const feed = (event: string, data: unknown, now: number) => {
      state = consumeAppStreamFrame(state, { event, data: JSON.stringify(data) }, now);
    };
    feed(APP_STREAM_EVENTS.started, { version: 1, providerId: "p", reasoningKind: "summary" }, 1);
    feed(APP_STREAM_EVENTS.reasoningDelta, { delta: "摘要", kind: "summary" }, 2);
    feed(APP_STREAM_EVENTS.contentDelta, { delta: "回答" }, 3);
    feed(APP_STREAM_EVENTS.extension, { type: "tool_use", callId: "call-1", name: "lookup", contentOffset: 999 }, 4);
    feed(APP_STREAM_EVENTS.contentDelta, { delta: "继续" }, 5);
    feed(APP_STREAM_EVENTS.output, { images: [{ source: "https://x/a.png" }, { source: "https://x/a.png" }] }, 6);
    feed(APP_STREAM_EVENTS.usage, { inputTokens: 3, outputTokens: 2, totalTokens: 5, estimated: false }, 7);
    feed(APP_STREAM_EVENTS.completed, { finishReason: "stop" }, 8);
    const completed = state;
    expect(() => feed(APP_STREAM_EVENTS.contentDelta, { delta: "不应追加" }, 7))
      .toThrow(/终态之后/);
    expect(state).toBe(completed);
    expect(state).toMatchObject({
      status: "completed",
      reasoning: "摘要",
      content: "回答继续",
      reasoningKind: "summary",
      finishReason: "stop",
      usage: { totalTokens: 5 }
    });
    expect(state.toolEvents[0]).toMatchObject({ callId: "call-1", contentOffset: 2 });
    expect(state.images).toHaveLength(1);
  });

  test("started 必须第一条且只能出现一次", () => {
    const initial = createAppStreamState();
    expect(() => consumeAppStreamFrame(initial, {
      event: APP_STREAM_EVENTS.contentDelta,
      data: '{"delta":"越序"}'
    })).toThrow(/必须是成功流的第一条/);
    const started = consumeAppStreamFrame(initial, {
      event: APP_STREAM_EVENTS.started,
      data: '{"version":1,"providerId":"p","reasoningKind":"thinking"}'
    });
    expect(() => consumeAppStreamFrame(started, {
      event: APP_STREAM_EVENTS.started,
      data: '{"version":1,"providerId":"p","reasoningKind":"thinking"}'
    })).toThrow(/只能发送一次/);
  });

  test("跨 delta 的 think 标签集中进入 reasoning", () => {
    let state = createAppStreamState();
    state = reduceAppStreamState(state, { type: "started", version: 1, providerId: "p", reasoningKind: "thinking" });
    for (const delta of ["<thi", "nk>隐", "藏</th", "ink>正文"]) {
      state = reduceAppStreamState(state, { type: "content.delta", delta });
    }
    state = reduceAppStreamState(state, { type: "completed", finishReason: "stop" });
    expect(state.reasoning).toBe("隐藏");
    expect(state.content).toBe("正文");
  });

  test("拆分的 think 标签完整出现前仍是等待态，出现思考文本后才进入思考态", () => {
    let state = reduceAppStreamState(createAppStreamState(), {
      type: "started",
      version: 1,
      providerId: "p",
      reasoningKind: "thinking"
    });
    state = reduceAppStreamState(state, { type: "content.delta", delta: "<thi" });
    expect(state.phase).toBe("waiting");
    expect(state.reasoning).toBe("");
    state = reduceAppStreamState(state, { type: "content.delta", delta: "nk>思考" }, 40);
    expect(state.phase).toBe("thinking");
    expect(state.reasoning).toBe("思考");
    expect(state.reasoningStartedAt).toBe(40);
  });

  test("正文开始后进入回答阶段，后续 reasoning 增量不会切回思考阶段", () => {
    let state = createAppStreamState();
    state = reduceAppStreamState(state, { type: "started", version: 1, providerId: "p", reasoningKind: "thinking" });
    state = reduceAppStreamState(state, { type: "reasoning.delta", delta: "先思考", kind: "thinking" });
    expect(state.phase).toBe("thinking");

    state = reduceAppStreamState(state, { type: "content.delta", delta: "第一段正文" });
    expect(state.phase).toBe("answering");
    expect(state.contentStartedAt).toBeGreaterThan(0);

    state = reduceAppStreamState(state, { type: "reasoning.delta", delta: "工具结果后的整理", kind: "thinking" });
    expect(state.phase).toBe("answering");
    state = reduceAppStreamState(state, { type: "completed", finishReason: "stop" });
    expect(state.phase).toBe("completed");
  });

  test("EOF、错误和取消都会收口 think 暂存内容", () => {
    const partial = reduceAppStreamState(
      reduceAppStreamState(createAppStreamState(), {
        type: "started",
        version: 1,
        providerId: "p",
        reasoningKind: "thinking"
      }),
      { type: "content.delta", delta: "正文<thi" }
    );
    expect(finalizeAppStreamState(partial).content).toBe("正文<thi");
    expect(cancelAppStreamState(partial)).toMatchObject({ content: "正文<thi", status: "cancelled", stopped: true });
    expect(reduceAppStreamState(partial, { type: "error", message: "失败" }))
      .toMatchObject({ content: "正文<thi", status: "failed", error: "失败" });
  });
});

describe("Update scheduler", () => {
  test("可见流按帧合并，后台流使用 200ms 定时器", () => {
    const publish = vi.fn();
    let visible = true;
    let frameCallback: FrameRequestCallback | null = null;
    let timerCallback: (() => void) | null = null;
    const scheduler = createStreamScheduler({
      publish,
      isVisible: () => visible,
      requestFrame(callback) { frameCallback = callback; return 1; },
      cancelFrame() {},
      setTimer(callback) { timerCallback = callback as () => void; return 2; },
      clearTimer() {}
    });
    scheduler.schedule();
    scheduler.schedule();
    expect(publish).not.toHaveBeenCalled();
    (frameCallback as unknown as (time: number) => void)(0);
    expect(publish).toHaveBeenCalledTimes(1);
    visible = false;
    scheduler.schedule();
    (timerCallback as unknown as () => void)();
    expect(publish).toHaveBeenCalledTimes(2);
    expect(scheduler.markdownDelay(8)).toBe(48);
    expect(scheduler.markdownDelay(40)).toBe(160);
  });

  test("终态由 React 接管时可取消待执行帧而不重复发布", () => {
    const publish = vi.fn();
    const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(17);
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const registry = createStreamRegistry({
      isVisible: () => true,
      publish
    });
    const stream = registry.create("conversation-1", "message-1");

    stream.scheduler.schedule();
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(registry.finish("conversation-1", { flush: false })).toBe(stream);
    expect(cancelFrame).toHaveBeenCalledWith(17);
    expect(publish).not.toHaveBeenCalled();
    expect(registry.has("conversation-1")).toBe(false);

    requestFrame.mockRestore();
    cancelFrame.mockRestore();
  });
});
