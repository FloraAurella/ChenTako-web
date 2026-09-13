import { Registry } from '../core/registry.ts';
import { RouteRegistry } from '../core/router.ts';
import { dispatchWebRequest } from '../core/web-transport.ts';
import { createModuleRuntime } from '../core/modules.ts';
import type { BackendContributions } from '../contracts/contributions.ts';
import { createProvidersModule, ProviderRepository, type SqlDatabase } from '../modules/providers/public/edge.ts';
import { createUpstreamModule } from '../modules/upstream/public/module.ts';
import { validateEdgeUrl } from '../modules/upstream/public/edge.ts';
import { createChatModule } from '../modules/chat/public/module.ts';
import { edgeGateway, edgeCors, tenantDigest } from '../modules/gateway/public/edge.ts';
import summary from '../../prompts/summary.json';
import title from '../../prompts/title.json';

interface WorkerEnv {
  VAULT_MASTER_KEY: string;
  CORS_ORIGINS: string;
  VAULTS: { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } };
}
interface VaultState {
  storage: { sql: { exec(sql: string, ...values: any[]): { toArray(): any[] } } };
  waitUntil(promise: Promise<unknown>): void;
}
/** One durable SQLite database per unguessable browser credential. No chat storage. */
export class ProviderVault {
  private contributions: BackendContributions;
  private active = 0;
  private recent: number[] = [];
  constructor(private state: VaultState, private env: WorkerEnv) {
    if (!/^[a-f0-9]{64}$/.test(env.VAULT_MASTER_KEY || '')) throw new Error('云端凭据存储尚未配置');
    const sql = state.storage.sql;
    const database: SqlDatabase = {
      exec: query => sql.exec(query),
      prepare: query => ({ all: (...v) => sql.exec(query, ...v).toArray(), get: (...v) => sql.exec(query, ...v).toArray()[0], run: (...v) => sql.exec(query, ...v) }),
      close() {}
    };
    this.contributions = {
      routes: new RouteRegistry(), services: new Registry(),
      config: { host: '', port: 0, apiToken: '', corsOrigins: [], allowNullOrigin: false, dataDir: '', ssrfAllow: [], bodyLimitBytes: 20 * 1024 * 1024, disabledModules: [] }
    };
    const runtime = createModuleRuntime([
      edgeGateway, createUpstreamModule(validateEdgeUrl),
      createProvidersModule(() => new ProviderRepository(database, Buffer.from(env.VAULT_MASTER_KEY, 'hex'))),
      createChatModule(name => { const value = name === 'summary' ? summary : title; if (typeof value !== 'string' || !value.trim()) throw new Error(`请先填写 ${name} 提示词`); return value; })
    ], this.contributions);
    runtime.start();
  }
  async fetch(request: Request) {
    const now = Date.now(); this.recent = this.recent.filter(t => now - t < 60000);
    if (this.active >= 4 || this.recent.length >= 120) return Response.json({ error: '请求过于频繁，请稍后重试' }, { status: 429 });
    this.active++; this.recent.push(now);
    const cors = edgeCors(request, this.env.CORS_ORIGINS);
    if (!cors) { this.active--; return Response.json({ error: '请求来源不被允许' }, { status: 403 }); }
    const operation = dispatchWebRequest(request, this.contributions.routes, cors);
    this.state.waitUntil(operation.finished.finally(() => { this.active--; }));
    return operation.response;
  }
}
export default {
  async fetch(request: Request, env: WorkerEnv) {
    const cors = edgeCors(request, env.CORS_ORIGINS);
    if (!cors) return Response.json({ error: '请求来源不被允许' }, { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (new URL(request.url).pathname === '/api/health') return Response.json({ ok: true, service: 'ChenTako-cloud', storage: 'isolated' }, { headers: cors });
    const tenant = await tenantDigest(request);
    if (!tenant) return Response.json({ error: '缺少浏览器凭据，请刷新页面重试' }, { status: 401, headers: cors });
    try { return await env.VAULTS.get(env.VAULTS.idFromName(tenant)).fetch(request); }
    catch { return Response.json({ error: '云端服务暂时无法完成请求，请稍后重试' }, { status: 503, headers: cors }); }
  }
};
