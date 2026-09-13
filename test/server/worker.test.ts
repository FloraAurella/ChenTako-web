// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import worker, { ProviderVault } from '../../server/app/worker.ts';
import { RouteRegistry, SseWriter } from '../../server/core/router.ts';
import { dispatchWebRequest } from '../../server/core/web-transport.ts';
vi.mock('../../prompts/summary.json', () => ({ default: 'SUMMARY_FIXTURE' }));
vi.mock('../../prompts/title.json', () => ({ default: 'TITLE_FIXTURE' }));
const databases: DatabaseSync[] = [];
const provider = { id: 'p', displayName: 'Test', baseUrl: 'https://example.com/v1', responseFormat: 'openai-compatible', models: ['m'], defaultModel: 'm', contextWindow: 131072, maxTokens: 8192 };
function environment() {
  const vaults = new Map<string, ProviderVault>();
  const env = { VAULT_MASTER_KEY: '11'.repeat(32), CORS_ORIGINS: 'https://site.example', VAULTS: {
    idFromName: (id: string) => id,
    get(id: unknown) {
      if (!vaults.has(String(id))) {
        const db = new DatabaseSync(':memory:'); databases.push(db);
        const state = { storage: { sql: { exec(sql: string, ...args: any[]) {
          const statement = db.prepare(sql); return { toArray: () => statement.all(...args) };
        } } }, waitUntil(p: Promise<unknown>) { void p; } };
        // Durable SQL exec is eager; preserve this behavior in the local fixture.
        const exec = state.storage.sql.exec;
        state.storage.sql.exec = (sql, ...args) => { const rows = exec(sql, ...args).toArray(); return { toArray: () => rows }; };
        vaults.set(String(id), new ProviderVault(state, env));
      }
      return vaults.get(String(id))!;
    }
  } };
  const call = (path: string, body?: unknown, token = 'a'.repeat(64), method = body ? 'POST' : 'GET', origin = 'https://site.example') => worker.fetch(new Request('https://api.example' + path, { method, headers: { origin, 'content-type': 'application/json', 'x-chentako-vault': token }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
  return { call };
}
afterEach(() => { vi.unstubAllGlobals(); for (const db of databases.splice(0)) db.close(); });
describe('cloud worker transport and isolated vaults', () => {
  it('checks origins and credentials; isolated CRUD preserves encrypted keys', async () => {
    const { call } = environment();
    expect((await call('/api/health')).status).toBe(200);
    expect((await call('/api/providers', undefined, '')).status).toBe(401);
    expect((await call('/api/providers', undefined, 'a'.repeat(64), 'GET', 'https://evil.example')).status).toBe(403);
    expect((await call('/api/providers', provider, undefined, 'PUT')).status).toBe(200);
    expect((await call('/api/providers/key', { id: 'p', displayName: 'Test', apiKey: 'fake-test-key' }, undefined, 'PUT')).status).toBe(200);
    expect(await (await call('/api/providers/key?id=p')).json()).toMatchObject({ apiKey: 'fake-test-key' });
    expect(await (await call('/api/providers', undefined, 'b'.repeat(64))).json()).toEqual({ providers: [] });
    const stored = JSON.stringify(databases[0]!.prepare('SELECT * FROM keys').all());
    expect(stored).not.toContain('fake-test-key');
    expect((await call('/api/providers/p', {}, undefined, 'DELETE')).status).toBe(200);
  });
  it('reuses chat, summary and title routes with full input and SSE, rejecting tools', async () => {
    const seen: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: any) => {
      if (String(url).startsWith('https://cloudflare-dns.com/')) return Response.json({ Status: 0, Answer: [{ type: 1, data: '93.184.216.34' }] });
      const body = JSON.parse(options.body); seen.push(body);
      if (body.stream) return new Response('data: {"choices":[{"delta":{"content":"流式内容"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
      return Response.json({ choices: [{ message: { content: '有效回复' }, finish_reason: 'stop' }] });
    }));
    const { call } = environment();
    await call('/api/providers', { ...provider, apiKey: 'fake-test-key' }, undefined, 'PUT');
    const request = { provider, model: 'm', messages: [{ role: 'user', content: '完整正文' }], chatConfig: { version: 1, systemPrompt: 'SYSTEM_FIXTURE', streaming: false, userId: '', temperature: 0.7, topP: 1, inputBudget: null, reasoningEffort: 'medium' } };
    const result = await call('/api/chat', request);
    const payload = await result.json(); expect(result.status, JSON.stringify(payload)).toBe(200); expect(payload).toMatchObject({ content: '有效回复' });
    expect(JSON.stringify(seen[0])).toContain('完整正文');
    expect(JSON.stringify(seen[0])).toContain('SYSTEM_FIXTURE');
    expect(await (await call('/api/chat/title', { provider, model: 'm', input: '题材' })).json()).toMatchObject({ title: '有效回复' });
    expect(JSON.stringify(seen[1])).toContain('TITLE_FIXTURE');
    expect(await (await call('/api/chat/compress', { provider, model: 'm', messages: request.messages })).json()).toMatchObject({ summary: '有效回复' });
    expect(JSON.stringify(seen[2])).toContain('SUMMARY_FIXTURE'); expect(JSON.stringify(seen[2])).not.toContain('SYSTEM_FIXTURE');
    const stream = await call('/api/chat', { ...request, chatConfig: { ...request.chatConfig, streaming: true } });
    const text = await stream.text(); expect(text).toContain('流式内容'); expect(text).toContain('chat.stream.completed');
    expect((await call('/api/chat', { ...request, extensions: { sandbox: true } })).status).toBe(400);
  });
  it('propagates reader cancellation to route lifecycle and releases listeners', async () => {
    const routes = new RouteRegistry(); let closed = false;
    routes.register('test', { id: 'stream', method: 'POST', pattern: '/stream', handler: async ({ res }) => {
      const stopped = new Promise<void>(resolve => res.once('close', () => { closed = true; resolve(); }));
      const writer = new SseWriter(res); await writer.event('start', {}); await stopped;
    } });
    const operation = dispatchWebRequest(new Request('https://api.example/stream', { method: 'POST' }), routes);
    const response = await operation.response;
    const reader = response.body!.getReader(); await reader.read(); await reader.cancel(); await operation.finished;
    expect(closed).toBe(true);
  });
});
