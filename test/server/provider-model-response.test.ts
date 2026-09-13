// @vitest-environment node
import { it, expect, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { bootTestServer, type TestServer } from './boot.ts';
const servers: TestServer[] = [];
const upstreams: Server[] = [];
afterAll(async () => {
  for (const server of servers) await server.close();
  for (const server of upstreams) { server.close(); server.closeAllConnections(); }
});
for (const format of ['openai-compatible', 'responses', 'anthropic', 'google']) {
  it(`${format}: tests the selected model with a real local response, preserving model-list test`, async () => {
    const calls: any[] = [];
    const mock = createServer(async (req, res) => {
      let text = ''; for await (const chunk of req) text += chunk;
      calls.push({ url: req.url, body: text ? JSON.parse(text) : null });
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET') { res.end(JSON.stringify({ data: [{ id: 'a' }] })); return; }
      const model = calls.at(-1).body.model || decodeURIComponent(req.url || '');
      if (model.includes('bad')) { res.writeHead(403).end('{}'); return; }
      if (model.includes('empty')) { res.end('{}'); return; }
      const payload = format === 'responses' ? { output: [{ type: 'message', content: [{ type: 'output_text', text: 'OK' }] }] }
        : format === 'anthropic' ? { content: [{ type: 'text', text: 'OK' }] }
        : format === 'google' ? { candidates: [{ content: { parts: [{ text: 'OK' }] } }] }
        : { choices: [{ message: { content: 'OK' } }] };
      res.end(JSON.stringify(payload));
    });
    upstreams.push(mock);
    await new Promise<void>(resolve => mock.listen(0, '127.0.0.1', resolve));
    const server = await bootTestServer({ ssrfAllow: ['127.0.0.1'] }); servers.push(server);
    const baseUrl = `http://127.0.0.1:${(mock.address() as any).port}`;
    const probe = (model?: string) => fetch(`${server.baseUrl}/api/providers/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl, responseFormat: format, model })
    });
    const response = await probe('selected-model');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ model: 'selected-model', reply: 'OK' });
    expect(format === 'google' ? calls[0].url : calls[0].body.model).toContain('selected-model');
    expect(JSON.stringify(calls[0].body)).toContain('Reply with OK.');
    expect((await probe('bad-model')).status).toBe(403);
    expect((await probe('')).status).toBe(400);
    const empty = await probe('empty-model');
    expect(empty.status).toBe(502);
    expect(await empty.json()).toMatchObject({ error: expect.stringContaining('未返回文字回复') });
    expect((await probe()).status).toBe(200);
  });
}
