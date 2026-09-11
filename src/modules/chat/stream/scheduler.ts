export interface StreamSchedulerOptions {
  publish: () => void;
  isVisible: () => boolean;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
  setTimer?: (callback: () => void, delay: number) => number;
  clearTimer?: (handle: number) => void;
}

export interface StreamScheduler {
  schedule(): void;
  flush(): void;
  dispose(): void;
  markdownDelay(renderDurationMs: number): number;
}

export function createStreamScheduler(options: StreamSchedulerOptions): StreamScheduler {
  const requestFrame = options.requestFrame || window.requestAnimationFrame.bind(window);
  const cancelFrame = options.cancelFrame || window.cancelAnimationFrame.bind(window);
  const setTimer = options.setTimer || window.setTimeout.bind(window);
  const clearTimer = options.clearTimer || window.clearTimeout.bind(window);
  let frame = 0;
  let timer = 0;
  let disposed = false;

  const flush = () => {
    if (disposed) return;
    if (frame) cancelFrame(frame);
    if (timer) clearTimer(timer);
    frame = 0;
    timer = 0;
    options.publish();
  };

  const schedule = () => {
    if (disposed || frame || timer) return;
    if (options.isVisible()) {
      frame = requestFrame(() => {
        frame = 0;
        options.publish();
      });
    } else {
      timer = setTimer(() => {
        timer = 0;
        options.publish();
      }, 200);
    }
  };

  return {
    schedule,
    flush,
    dispose() {
      disposed = true;
      if (frame) cancelFrame(frame);
      if (timer) clearTimer(timer);
      frame = 0;
      timer = 0;
    },
    markdownDelay(renderDurationMs: number) {
      return Math.max(48, Math.min(160, renderDurationMs > 12 ? renderDurationMs * 4 : 48));
    }
  };
}
