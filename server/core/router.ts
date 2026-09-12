import type { IncomingMessage, ServerResponse } from 'node:http';
import { Registry } from './registry.ts';

/** 带 HTTP 状态码的业务错误：gateway 统一转成 JSON 错误响应。 */
export class HttpError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = '') {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
}

export interface RouteContribution {
  id: string;
  method: string;
  /** 如 `/api/providers/:id`；`:name` 段捕获为 params。 */
  pattern: string;
  handler: (context: RequestContext) => void | Promise<void>;
}

/** 路由贡献注册表：各业务模块注册端点，gateway 在请求时动态查询。 */
export class RouteRegistry extends Registry<RouteContribution> {}

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  if (res.writableEnded || res.destroyed) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 读取 JSON 请求体。image 消息单次最多 80MB，Base64/JSON 还有约 1/3 膨胀，
 * 与原版一致默认 130MB 上限；非 JSON content-type 直接 415。
 */
export async function readJsonBody(req: IncomingMessage, limitBytes = 130 * 1024 * 1024): Promise<Record<string, unknown>> {
  const contentType = String(req.headers['content-type'] || '');
  if (contentType && !contentType.toLowerCase().startsWith('application/json')) {
    throw new HttpError('请求必须使用 application/json', 415);
  }
  let bytes = 0;
  const parts: Buffer[] = [];
  for await (const part of req) {
    bytes += part.length;
    if (bytes > limitBytes) throw new HttpError('请求超过大小上限', 413);
    parts.push(part as Buffer);
  }
  const text = Buffer.concat(parts).toString('utf8');
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError('请求体不是合法的 JSON 对象', 400);
  }
}

/**
 * 应用层 SSE 写出器：与原版 sse.ts 相同的头与背压处理；整条事件一个 chunk，
 * 避免头/数据两次写入在代理侧错序。
 */
export class SseWriter {
  private res: ServerResponse;
  constructor(res: ServerResponse) {
    this.res = res;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
  }
  get closed() { return this.res.writableEnded || this.res.destroyed; }
  private write(chunk: string): Promise<void> {
    const res = this.res;
    if (!chunk || res.writableEnded || res.destroyed) return Promise.resolve();
    if (res.write(chunk)) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        res.removeListener('drain', finish);
        res.removeListener('close', finish);
        resolve();
      };
      res.once('drain', finish);
      res.once('close', finish);
      if (res.writableEnded || res.destroyed) finish();
    });
  }
  async event(name: string, data: unknown): Promise<void> {
    await this.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  end() { this.res.end(); }
}
