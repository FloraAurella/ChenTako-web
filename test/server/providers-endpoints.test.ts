// @vitest-environment node
import { describe, it, expect, afterAll, vi } from 'vitest';
import { createServer as createHttpServer, type Server } from 'node:http';
import { bootTestServer, type TestServer } from './boot.ts';

const servers: TestServer[] = [];
const upstreams: Server[] = [];
afterAll(async () => {
  for (const server of servers.reverse()) await server.close();
  for (const upstream of upstreams) { upstream.close(); upstream.closeAllConnections(); }
});

async function boot(overrides = {}) {
  const server = await bootTestServer(overrides);
  servers.push(server);
  return server;
}

/** 本地 mock 上游：GET /models 返回固定模型清单（127.0.0.1 属回环，需 SSRF 白名单放行）。 */
async function bootMockUpstream(): Promise<string> {
  const upstream = createHttpServer((req, res) => {
    if (req.url === '/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'model-b' }, { id: 'model-a' }] }));
      return;
    }
    res.writeHead(404).end();
  });
  upstreams.push(upstream);
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const address = upstream.address();
  if (!address || typeof address === 'string') throw new Error('mock upstream 未监听');
  return `http://127.0.0.1:${address.port}`;
}

const VALID_PROVIDER = {
  displayName: '集成供应商',
  baseUrl: 'https://api.example.com/v1',
  responseFormat: 'openai-compatible',
  models: ['m1', 'm2'],
  defaultModel: 'm1',
  settingsSchemaVersion: 1
};

describe('providers 端点集成', () => {
  it('PUT 创建 → GET 列表（无 keyEnv、hasKeyConfigured=false）→ PUT 带 Key → hasKeyConfigured=true', async () => {
    const server = await boot();
    const created = await fetch(`${server.baseUrl}/api/providers`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173' },
      body: JSON.stringify(VALID_PROVIDER)
    });
    expect(created.status).toBe(200);
    const createdPayload = await created.json() as any;
    expect(createdPayload.ok).toBe(true);
    expect(createdPayload.keyEnv).toBe('集成供应商'.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'provider');
    expect(createdPayload.provider.hasKeyConfigured).toBe(false);
    expect(createdPayload.provider.settingsSchemaVersion).toBeUndefined();
    expect(createdPayload.provider.systemPrompt).toBe(''); // settingsSchemaVersion 1 重置全局字段

    const list = await fetch(`${server.baseUrl}/api/providers`);
    const listPayload = await list.json() as any;
    expect(listPayload.providers).toHaveLength(1);
    expect(listPayload.providers[0]).toMatchObject({ displayName: '集成供应商', baseUrl: 'https://api.example.com/v1', hasKeyConfigured: false });
    expect('keyEnv' in listPayload.providers[0]).toBe(false);

    const withKey = await fetch(`${server.baseUrl}/api/providers`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_PROVIDER, apiKey: 'sk-integration' })
    });
    expect(((await withKey.json()) as any).provider.hasKeyConfigured).toBe(true);
  });

  it('key 端点：保存/读取（no-store）/删除/404 语义', async () => {
    const server = await boot();
    const created = await (await fetch(`${server.baseUrl}/api/providers`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_PROVIDER)
    })).json() as any;
    const providerId = created.provider.id as string;

    const saved = await fetch(`${server.baseUrl}/api/providers/key`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: providerId, displayName: '集成供应商', apiKey: 'sk-xyz' })
    });
    expect(await saved.json() as any).toMatchObject({ ok: true, hasKeyConfigured: true });

    const revealed = await fetch(`${server.baseUrl}/api/providers/key?id=${encodeURIComponent(providerId)}`);
    expect(revealed.headers.get('cache-control')).toContain('no-store');
    expect(await revealed.json() as any).toEqual({ ok: true, apiKey: 'sk-xyz' });

    const removed = await fetch(`${server.baseUrl}/api/providers/key`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: providerId, displayName: '集成供应商' })
    });
    expect(await removed.json() as any).toEqual({ ok: true, removed: true });

    const missing = await fetch(`${server.baseUrl}/api/providers/key?id=${encodeURIComponent(providerId)}`);
    expect(missing.status).toBe(404);

    const unknown = await fetch(`${server.baseUrl}/api/providers/key`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'ghost', displayName: '鬼', apiKey: 'sk-1' })
    });
    expect(unknown.status).toBe(404);
  });

  it('删除供应商带 body 回退匹配；不存在返回 404；同路径方法不匹配返回 405', async () => {
    const server = await boot();
    const created = await (await fetch(`${server.baseUrl}/api/providers`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_PROVIDER, apiKey: 'sk-del' })
    })).json() as any;
    const providerId = created.provider.id as string;

    // :id 是 DELETE-only；GET 应 405
    const wrongMethod = await fetch(`${server.baseUrl}/api/providers/${providerId}`);
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get('allow')).toContain('DELETE');

    const removed = await fetch(`${server.baseUrl}/api/providers/${providerId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '集成供应商', baseUrl: 'https://api.example.com/v1' })
    });
    expect(await removed.json() as any).toEqual({ ok: true, removed: true, keyRemoved: true });
    expect(((await (await fetch(`${server.baseUrl}/api/providers`)).json()) as any).providers).toHaveLength(0);
    const again = await fetch(`${server.baseUrl}/api/providers/${providerId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    expect(again.status).toBe(404);
  });

  it('非法载荷：缺 displayName、坏覆盖、坏 Key 形态、超大 body 413', async () => {
    const server = await boot({ bodyLimitBytes: 1024 });
    const missing = await fetch(`${server.baseUrl}/api/providers`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"baseUrl":"https://x.com"}'
    });
    expect(missing.status).toBe(400);
    const badOverride = await fetch(`${server.baseUrl}/api/providers`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_PROVIDER, modelOverrides: { ghost: {} } })
    });
    expect(badOverride.status).toBe(400);
    const badKey = await fetch(`${server.baseUrl}/api/providers/key`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'x', displayName: 'X', apiKey: 'a\nb' })
    });
    expect(badKey.status).toBe(400);
    const oversized = await fetch(`${server.baseUrl}/api/providers`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_PROVIDER, padding: 'x'.repeat(2048) })
    });
    expect(oversized.status).toBe(413);
  });

  it('连接测试：本地 mock 上游读取模型列表；无 Key 非回环 401；错误体转发状态码', async () => {
    const mockBase = await bootMockUpstream();
    const server = await boot({ ssrfAllow: ['127.0.0.1'] });
    const ok = await fetch(`${server.baseUrl}/api/providers/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '本地', baseUrl: mockBase, responseFormat: 'openai-compatible' })
    });
    const okPayload = await ok.json() as any;
    expect(ok.status).toBe(200);
    expect(okPayload).toMatchObject({ ok: true, models: ['model-a', 'model-b'] });
    expect(okPayload.message).toContain('2 个模型');
    expect(typeof okPayload.latencyMs).toBe('number');

    const noKey = await fetch(`${server.baseUrl}/api/providers/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '远程', baseUrl: 'https://93.184.216.34/v1', responseFormat: 'openai-compatible' })
    });
    expect(noKey.status).toBe(401);

    // 上游 404（/models 之外的 baseUrl 路径）转发上游状态码
    const upstream404 = await fetch(`${server.baseUrl}/api/providers/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '本地404', baseUrl: `${mockBase}/v9`, responseFormat: 'openai-compatible' })
    });
    expect(upstream404.status).toBe(404);

    // 负向用例必然触发网关的 5xx 错误日志：这里捕获为测试 Logger，
    // 只隔离本用例明确预期的输出，并顺带断言被记录的错误对象。
    const gatewayErrors: Array<{ status?: number; message?: string }> = [];
    const originalError = console.error;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(((...args: unknown[]) => {
      const entry = args[1] ?? args[0];
      if (args[0] === '[gateway]' && entry && typeof entry === 'object' && 'status' in entry && (entry as any).status === 502) {
        gatewayErrors.push(entry as { status?: number; message?: string });
      } else {
        originalError(...args);
      }
    }) as typeof console.error);

    try {
      const refused = await fetch(`${server.baseUrl}/api/providers/test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: '拒绝', baseUrl: 'http://127.0.0.1:1', responseFormat: 'openai-compatible' })
      });
      expect(refused.status).toBe(502);

      const ssrf = await fetch(`${server.baseUrl}/api/providers/test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: '内网', baseUrl: 'http://10.0.0.1/v1', responseFormat: 'openai-compatible' })
      });
      expect(ssrf.status).toBe(400);
      expect((await ssrf.json() as any).error).toContain('上游地址被拒绝');
    } finally {
      errorSpy.mockRestore();
    }
    expect(gatewayErrors.some((entry) => entry.status === 502 && String(entry.message).length > 0)).toBe(true);
  });
});
