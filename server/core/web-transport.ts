import { EventEmitter } from 'node:events';
import { HttpError, sendJson, type RouteRegistry, type RequestContext } from './router.ts';

/** Web Request/Response adapter for the existing owned route contracts. */
export function dispatchWebRequest(request: Request, routes: RouteRegistry, cors: Record<string, string> = {}): { response: Promise<Response>; finished: Promise<void> } {
  const url = new URL(request.url);
  const headers = new Headers(cors);
  let status = 200;
  let resolve!: (response: Response) => void;
  const response = new Promise<Response>(r => { resolve = r; });
  let streamController!: ReadableStreamDefaultController<Uint8Array>;
  const events = new EventEmitter();
  const res = Object.assign(events, {
    headersSent: false, writableEnded: false, destroyed: false,
    setHeader(name: string, value: string) { headers.set(name, String(value)); return res; },
    writeHead(code: number, values: Record<string, string> = {}) {
      status = code;
      for (const [name, value] of Object.entries(values)) if (name.toLowerCase() !== 'connection') headers.set(name, value);
      return res;
    },
    write(value: string | Uint8Array) {
      if (res.destroyed || res.writableEnded) return false;
      start();
      streamController.enqueue(typeof value === 'string' ? new TextEncoder().encode(value) : value);
      return (streamController.desiredSize || 0) > 0;
    },
    end(value?: string) {
      if (res.destroyed || res.writableEnded) return;
      if (value) res.write(value);
      start(); res.writableEnded = true; streamController.close(); events.emit('finish');
    },
    destroy() {
      if (res.destroyed || res.writableEnded) return;
      res.destroyed = true; start(); streamController.error(new Error('请求已中止')); events.emit('close');
    }
  });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { streamController = controller; },
    pull() { events.emit('drain'); },
    cancel() { res.destroyed = true; events.emit('close'); }
  });
  function start() {
    if (res.headersSent) return;
    res.headersSent = true;
    resolve(new Response(stream, { status, headers }));
  }
  const req = {
    method: request.method, url: url.pathname + url.search, headers: Object.fromEntries(request.headers),
    async *[Symbol.asyncIterator]() {
      if (!request.body) return;
      const reader = request.body.getReader();
      try { while (true) { const next = await reader.read(); if (next.done) break; yield Buffer.from(next.value); } }
      finally { reader.releaseLock(); }
    }
  };
  const abort = () => res.destroy();
  request.signal.addEventListener('abort', abort, { once: true });
  const finished = (async () => {
    try {
      if (request.signal.aborted) { abort(); return; }
      const actual = url.pathname.split('/').filter(Boolean);
      let samePath = false;
      for (const route of routes.list()) {
        const pattern = route.pattern.split('/').filter(Boolean);
        if (pattern.length !== actual.length || pattern.some((part, i) => !part.startsWith(':') && part !== actual[i])) continue;
        samePath = true;
        if (route.method !== request.method) continue;
        const params = Object.fromEntries(pattern.flatMap((part, i) => part.startsWith(':') ? [[part.slice(1), decodeURIComponent(actual[i]!)]] : []));
        await route.handler({ req, res, url, params } as unknown as RequestContext);
        if (!res.writableEnded && !res.destroyed) res.end();
        return;
      }
      throw new HttpError(samePath ? '该方法不被允许' : '接口不存在', samePath ? 405 : 404);
    } catch (error) {
      if (res.headersSent) res.destroy();
      else sendJson(res as unknown as RequestContext['res'], error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : '服务器无法完成请求' });
    } finally {
      request.signal.removeEventListener('abort', abort);
    }
  })();
  return { response, finished };
}
