export type Dispose = () => void;

/** Owns browser effects so a module can be stopped without leaking listeners or work. */
export class Scope {
  private cleanups = new Set<Dispose>();
  private closed = false;
  get disposed() { return this.closed; }
  defer(cleanup: Dispose) {
    if (this.closed) cleanup(); else this.cleanups.add(cleanup);
    return cleanup;
  }
  listen(target: EventTarget | null | undefined, type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) {
    if (!target || this.closed) return () => {};
    target.addEventListener(type, listener, options);
    return this.defer(() => target.removeEventListener(type, listener, options));
  }
  timeout(callback: () => void, delay = 0) {
    if (this.closed) return 0;
    const cleanup = () => window.clearTimeout(id);
    const id = window.setTimeout(() => { this.cleanups.delete(cleanup); if (!this.closed) callback(); }, delay);
    this.defer(cleanup);
    return id;
  }
  frame(callback: FrameRequestCallback) {
    if (this.closed) return 0;
    const cleanup = () => cancelAnimationFrame(id);
    const id = requestAnimationFrame(time => { this.cleanups.delete(cleanup); if (!this.closed) callback(time); });
    this.defer(cleanup);
    return id;
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    const errors: unknown[] = [];
    const cleanups = [...this.cleanups].reverse(); this.cleanups.clear();
    for (const cleanup of cleanups) {
      try { cleanup(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Scope cleanup failed');
  }
}
