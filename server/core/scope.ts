export type Dispose = () => void;

/**
 * Node 版作用域：与 src/core/scope.ts 同一释放语义（逆序、可重复、错误聚合），
 * 但不依赖 DOM——定时器换成 Node 计时器，另提供 AbortController 跟随释放。
 */
export class Scope {
  private cleanups = new Set<Dispose>();
  private closed = false;
  get disposed() { return this.closed; }
  defer(cleanup: Dispose) {
    if (this.closed) cleanup(); else this.cleanups.add(cleanup);
    return cleanup;
  }
  timeout(callback: () => void, delay = 0) {
    if (this.closed) return undefined;
    const cleanup = () => clearTimeout(id);
    const id = setTimeout(() => { this.cleanups.delete(cleanup); if (!this.closed) callback(); }, delay);
    this.cleanups.add(cleanup);
    return id;
  }
  interval(callback: () => void, delay: number) {
    if (this.closed) return undefined;
    const cleanup = () => clearInterval(id);
    const id = setInterval(callback, delay);
    this.cleanups.add(cleanup);
    return id;
  }
  /** 跟随作用域释放的中止控制器：作用域关闭即中止，用于上游请求与流。 */
  abort(controller: AbortController, reason?: unknown) {
    if (this.closed) { controller.abort(reason); return controller; }
    this.defer(() => controller.abort(reason));
    return controller;
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
