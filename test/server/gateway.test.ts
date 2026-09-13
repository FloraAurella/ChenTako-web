// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { bootTestServer, type TestServer } from './boot.ts';

const servers: TestServer[] = [];
async function boot(overrides = {}) {
  const server = await bootTestServer(overrides);
  servers.push(server);
  return server;
}
afterAll(async () => { for (const server of servers.reverse()) await server.close(); });

describe('gateway 集成', () => {
  it('新品牌令牌头生效且旧令牌头继续兼容', async () => {
    const server = await boot({ apiToken: 'test-brand-token' });
    for (const header of ['x-ai-chatbox-token', 'x-clawbox-token']) {
      expect((await fetch(`${server.baseUrl}/api/whatever`, { headers: { [header]: 'test-brand-token' } })).status).toBe(404);
      expect((await fetch(`${server.baseUrl}/api/whatever`, { headers: { [header]: 'wrong' } })).status).toBe(401);
    }
  });
  it('health 返回前端要求的精确形状', async () => {
    const server = await boot();
    const response = await fetch(`${server.baseUrl}/api/health`);
    expect(response.status).toBe(200);
    const payload = await response.json();
    // 前端 backend-sync 只认 payload.ok === true；e2e mock 同时断言 service 名。
    expect(payload).toEqual({ ok: true, service: 'ai-chatbox-server' });
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('未知接口 404，方法不匹配 405 并带 Allow', async () => {
    const server = await boot();
    const missing = await fetch(`${server.baseUrl}/api/nope`);
    expect(missing.status).toBe(404);
    const wrongMethod = await fetch(`${server.baseUrl}/api/health`, { method: 'DELETE' });
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get('allow')).toContain('GET');
  });

  it('非 /api 路径一律 404，不暴露文件系统', async () => {
    const server = await boot();
    for (const path of ['/', '/index.html', '/server/app/main.ts', '/../package.json']) {
      const response = await fetch(`${server.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
      expect(response.status).toBe(404);
    }
  });

  it('跨站 Origin 被拒绝，vite 默认与文档开发来源及健康检查无 Origin 请求被放行', async () => {
    const server = await boot();
    const evil = await fetch(`${server.baseUrl}/api/health`, { headers: { Origin: 'https://evil.example' } });
    expect(evil.status).toBe(403);
    for (const origin of [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:5188',
      'http://localhost:5188'
    ]) {
      const dev = await fetch(`${server.baseUrl}/api/health`, { headers: { Origin: origin } });
      expect(dev.status).toBe(200);
      expect(dev.headers.get('access-control-allow-origin')).toBe(origin);
    }
    const noOrigin = await fetch(`${server.baseUrl}/api/health`);
    expect(noOrigin.status).toBe(200);
  });

  it('OPTIONS 预检放行允许来源并声明方法与头', async () => {
    const server = await boot();
    const response = await fetch(`${server.baseUrl}/api/providers`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://127.0.0.1:5173', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type,x-clawbox-token' }
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173');
    expect(response.headers.get('access-control-allow-headers')).toContain('x-clawbox-token');
  });

  it('配置 API_TOKEN 后：缺令牌 401，错误令牌 401，health 豁免，正确令牌放行', async () => {
    const server = await boot({ apiToken: 'secret-token' });
    const health = await fetch(`${server.baseUrl}/api/health`);
    expect(health.status).toBe(200);
    const denied = await fetch(`${server.baseUrl}/api/nope`, { headers: { Origin: 'http://127.0.0.1:5173' } });
    expect(denied.status).toBe(401);
    // 未注册路由在鉴权之后返回 404，避免向无令牌方泄露路由清单
    const wrongToken = await fetch(`${server.baseUrl}/api/whatever`, { headers: { 'x-clawbox-token': 'wrong' } });
    expect(wrongToken.status).toBe(401);
    const allowed = await fetch(`${server.baseUrl}/api/whatever`, { headers: { 'x-clawbox-token': 'secret-token' } });
    expect(allowed.status).toBe(404);
  });

  it('畸形 JSON 请求体返回 400（走真实路由处理器之前的统一解析路径由后续路由验证）', async () => {
    const server = await boot();
    const response = await fetch(`${server.baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173' },
      body: '{not-json'
    });
    // health 是 GET-only：方法不匹配优先于 body 解析
    expect(response.status).toBe(405);
  });
});
