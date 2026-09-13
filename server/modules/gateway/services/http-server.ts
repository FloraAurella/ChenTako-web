import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { RouteRegistry, SseWriter, HttpError, errorMessage, sendJson, type RequestContext } from '../../../core/router.ts';

export interface GatewayOptions {
  host: string;
  port: number;
  apiToken: string;
  /** 额外允许的 CORS 来源（逗号分隔环境配置）。 */
  corsOrigins: string[];
  allowNullOrigin: boolean;
}

const DEV_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://127.0.0.1:5188',
  'http://localhost:5188'
];

function tokenMatches(expected: string, candidate: unknown): boolean {
  if (!expected) return true;
  const received = Buffer.from(String(candidate || ''));
  const buffer = Buffer.from(expected);
  if (received.length !== buffer.length) return false;
  return timingSafeEqual(received, buffer);
}

/**
 * API 网关：只监听本机回环，负责 Origin 校验、可选启动令牌、路由分发、
 * 404/405、CORS 预检与统一错误处理。业务路由由各模块注册进 RouteRegistry，
 * 请求时动态查询，模块装配顺序不影响可用性。
 */
export class HttpGateway {
  private server: Server;
  private routes: RouteRegistry;
  private options: GatewayOptions;
  constructor(routes: RouteRegistry, options: GatewayOptions) {
    this.routes = routes;
    this.options = options;
    this.server = createServer((req, res) => { void this.handle(req, res); });
    // 优雅关闭：停止接收新连接；keep-alive 空闲连接直接关
    this.server.keepAliveTimeout = 5000;
  }

  private allowedOrigins(req: IncomingMessage): Set<string> {
    const host = String(req.headers.host || `${this.options.host}:${this.options.port}`);
    const self = new Set([`http://${host}`]);
    if (host.startsWith('127.0.0.1') || host.startsWith('localhost')) {
      self.add(`http://127.0.0.1:${this.options.port}`);
      self.add(`http://localhost:${this.options.port}`);
    }
    return new Set([...self, ...DEV_ORIGINS, ...this.options.corsOrigins]);
  }

  private corsHeaders(req: IncomingMessage): Record<string, string> {
    const origin = String(req.headers.origin || '');
    const allowed = this.allowedOrigins(req);
    const allowOrigin = !origin || allowed.has(origin) ||
      (origin === 'null' && this.options.allowNullOrigin)
      ? origin || ''
      : '';
    const headers: Record<string, string> = {};
    if (allowOrigin) {
      headers['Access-Control-Allow-Origin'] = allowOrigin;
      headers['Vary'] = 'Origin';
    }
    return headers;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
      const method = (req.method || 'GET').toUpperCase();

      if (method === 'OPTIONS') {
        const headers = this.corsHeaders(req);
        if (!headers['Access-Control-Allow-Origin']) return sendJson(res, 403, { error: '请求来源不被允许' });
        res.writeHead(204, {
          ...headers,
          'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-ai-chatbox-token, x-clawbox-token, x-tribblebook-token',
          'Access-Control-Max-Age': '600'
        });
        res.end();
        return;
      }

      if (!url.pathname.startsWith('/api/')) {
        return sendJson(res, 404, { error: '接口不存在（后端仅提供 /api 服务）' });
      }
      const origin = String(req.headers.origin || '');
      if (origin && !this.allowedOrigins(req).has(origin) && !(origin === 'null' && this.options.allowNullOrigin)) {
        return sendJson(res, 403, { error: '请求来源不被允许' });
      }
      // 健康检查免令牌：前端以它区分「后端未启动」与「鉴权失败」。
      if (url.pathname !== '/api/health' && !tokenMatches(this.options.apiToken,
        req.headers['x-ai-chatbox-token'] ?? req.headers['x-clawbox-token'] ?? req.headers['x-tribblebook-token'])) {
        return sendJson(res, 401, { error: '本地 API 鉴权失败' });
      }

      const cors = this.corsHeaders(req);
      for (const [key, value] of Object.entries(cors)) res.setHeader(key, value);

      const match = this.match(method, url.pathname);
      if (!match) {
        const samePath = this.routes.list().filter((route) => pathMatches(route.pattern, url.pathname));
        if (samePath.length) {
          res.setHeader('Allow', [...new Set([...samePath.map((route) => route.method), 'OPTIONS'])].join(', '));
          return sendJson(res, 405, { error: '该方法不被允许' });
        }
        return sendJson(res, 404, { error: '接口不存在' });
      }
      await match.route.handler({ req, res, url, params: match.params });
    } catch (error) {
      if (res.headersSent) {
        // 中途失败（流已开始）只能终止连接；已写出的应用层错误事件不受影响。
        res.destroy();
        return;
      }
      const status = error instanceof HttpError ? error.status : 500;
      if (status >= 500) console.error('[gateway]', error);
      sendJson(res, status, { error: errorMessage(error) });
    }
  }

  private match(method: string, pathname: string): { route: { id: string; method: string; pattern: string; handler: (context: RequestContext) => void | Promise<void> }; params: Record<string, string> } | null {
    for (const route of this.routes.list()) {
      if (route.method !== method) continue;
      const params = pathParams(route.pattern, pathname);
      if (params) return { route, params };
    }
    return null;
  }

  listen(port = this.options.port, host = this.options.host): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      this.server.once('error', onError);
      this.server.listen(port, host, () => {
        this.server.removeListener('error', onError);
        console.log(`ChenTako 模块化后端已启动: http://${host}:${port}（仅本机回环）`);
        resolve();
      });
    });
  }

  /** 实际监听地址；port:0 启动时用于拿到临时端口（测试）。 */
  address(): { address: string; port: number } | null {
    const address = this.server.address();
    if (!address || typeof address === 'string') return null;
    return { address: address.address, port: address.port };
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
      // 长连接（SSE/keep-alive）不等待自然结束
      this.server.closeAllConnections();
    });
  }
}

function pathSegments(pattern: string): string[] {
  return pattern.split('/').filter(Boolean);
}

function pathParams(pattern: string, pathname: string): Record<string, string> | null {
  const parts = pathSegments(pattern);
  const actual = pathname.split('/').filter(Boolean);
  if (parts.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const value = actual[index]!;
    if (part.startsWith(':')) {
      if (!value) return null;
      params[part.slice(1)] = decodeURIComponent(value);
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function pathMatches(pattern: string, pathname: string): boolean {
  return pathParams(pattern, pathname) !== null;
}

export { SseWriter, HttpError, sendJson };
