import { createStreamScheduler, type StreamScheduler } from "./scheduler";
import { cancelAppStreamState, createAppStreamState, type AppStreamState } from "./session";

export interface RegisteredStream {
  conversationId: string;
  messageId: string;
  controller: AbortController;
  state: AppStreamState;
  scheduler: StreamScheduler;
}

export interface StreamRegistryOptions {
  isVisible: (conversationId: string) => boolean;
  publish: (stream: RegisteredStream) => void;
}

export function createStreamRegistry(options: StreamRegistryOptions) {
  const streams = new Map<string, RegisteredStream>();

  function create(conversationId: string, messageId: string, format = ""): RegisteredStream {
    if (streams.has(conversationId)) throw new Error("该会话已有正在进行的生成任务");
    const controller = new AbortController();
    const stream = {} as RegisteredStream;
    Object.assign(stream, {
      conversationId,
      messageId,
      controller,
      state: createAppStreamState(format),
      scheduler: createStreamScheduler({
        isVisible: () => options.isVisible(conversationId),
        publish: () => options.publish(stream)
      })
    });
    streams.set(conversationId, stream);
    return stream;
  }

  function stop(conversationId: string): void {
    const stream = streams.get(conversationId);
    if (!stream) return;
    stream.state = cancelAppStreamState(stream.state);
    stream.scheduler.flush();
    stream.controller.abort();
  }

  function finish(conversationId: string, { flush = true }: { flush?: boolean } = {}): RegisteredStream | null {
    const stream = streams.get(conversationId) || null;
    if (!stream) return null;
    // Some callers commit the authoritative final message through React. In
    // that path flushing the pending incremental paint would parse and mount
    // the same (potentially very large) Markdown twice in one task.
    if (flush) stream.scheduler.flush();
    stream.scheduler.dispose();
    streams.delete(conversationId);
    return stream;
  }

  function stopAll(): void {
    for (const id of [...streams.keys()]) stop(id);
  }

  return {
    create,
    get: (conversationId: string) => streams.get(conversationId) || null,
    has: (conversationId: string) => streams.has(conversationId),
    values: () => streams.values(),
    stop,
    finish,
    stopAll,
    get size() { return streams.size; }
  };
}
