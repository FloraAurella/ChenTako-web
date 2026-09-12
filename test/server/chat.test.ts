// @vitest-environment node
import { describe, it, expect, afterAll, vi } from 'vitest';
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { bootTestServer, type TestServer } from './boot.ts';
import { consumeAppStreamFrame, createAppStreamState, type AppStreamState } from '../../src/modules/chat/stream/session.ts';
import { APP_STREAM_EVENTS } from '../../src/modules/chat/stream/protocol.ts';

const servers: TestServer[] = [];
const upstreams: Array<{ server: Server; requests: Array<{ url: string; body: string }> }> = [];
afterAll(async () => {
  for (const server of servers.reverse()) await server.close();
  for (const entry of upstreams) { entry.server.close(); entry.server.closeAllConnections(); }
});

async function boot(overrides = {}) {
  const server = await bootTestServer({ ssrfAllow: ['127.0.0.1'], ...overrides });
  servers.push(server);
  return server;
}

type MockHandler = (req: IncomingMessage, res: ServerResponse, body: string) => void;
async function bootMockUpstream(handler: MockHandler) {
  const requests: Array<{ url: string; body: string }> = [];
  const server = createHttpServer((req, res) => {
    const parts: Buffer[] = [];
    req.on('data', (chunk) => parts.push(chunk as Buffer));
    req.on('end', () => {
      const body = Buffer.concat(parts).toString('utf8');
      requests.push({ url: req.url || '', body });
      handler(req, res, body);
    });
  });
  upstreams.push({ server, requests });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('mock upstream 未监听');
  return { url: `http://127.0.0.1:${address.port}`, requests };
}

async function createProvider(server: TestServer, provider: Record<string, unknown>): Promise<any> {
  const response = await fetch(`${server.baseUrl}/api/providers`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ responseFormat: 'openai-compatible', models: ['m1'], defaultModel: 'm1', ...provider })
  });
  const payload = await response.json() as any;
  if (!response.ok) throw new Error(`供应商创建失败: ${payload.error}`);
  return payload.provider;
}

const CHAT_CONFIG = {
  version: 1, systemPrompt: '', userId: '', temperature: 0.7, topP: 1,
  inputBudget: null, reasoningEffort: 'medium', streaming: true
};

function chatBody(provider: any, overrides: Record<string, unknown> = {}) {
  return {
    provider: { id: provider.id, displayName: provider.displayName, baseUrl: provider.baseUrl, responseFormat: provider.responseFormat },
    model: 'm1',
    chatConfig: { ...CHAT_CONFIG },
    stream: true,
    contextSummary: '',
    extensions: { tools: [], skills: [], sandbox: false, codeInterpreter: false },
    messages: [{ role: 'user', content: '你好' }],
    ...overrides
  };
}

function post(server: TestServer, path: string, body: unknown, init: RequestInit = {}): Promise<Response> {
  return fetch(`${server.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173' },
    body: JSON.stringify(body),
    ...init
  });
}

interface RawFrame { event: string; data: string }
async function readSse(response: Response, onFrame?: (frame: RawFrame) => void): Promise<RawFrame[]> {
  const frames: RawFrame[] = [];
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.match(/\r\n\r\n|\n\n/);
    while (separator && separator.index !== undefined) {
      const raw = buffer.slice(0, separator.index);
      buffer = buffer.slice(separator.index + separator[0].length);
      let event = ''; const dataLines: string[] = [];
      for (const line of raw.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        if (line.startsWith('data: ')) dataLines.push(line.slice(6));
      }
      if (event || dataLines.length) {
        const frame = { event, data: dataLines.join('\n') };
        frames.push(frame);
        onFrame?.(frame);
      }
      separator = buffer.match(/\r\n\r\n|\n\n/);
    }
  }
  return frames;
}

function sseChunk(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

describe('/api/chat 集成', () => {
  it('流式：经前端 consumeAppStreamFrame 状态机验收事件顺序与最终状态', async () => {
    const server = await boot();
    const upstream = await bootMockUpstream((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(sseChunk({ choices: [{ delta: { role: 'assistant', reasoning_content: '想' } }] }));
      res.write('data: {"choices":[{"delta":{"content":"你"}}]}\n\n');
      res.write('data: {"choices":[{"delta":{"content":"好世"}}]}\n\n');
      res.write('data: {"choices":[{"delta":{"content":"界"},"finish_reason":null}]}\n\n');
      res.end('data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n\n');
    });
    const provider = await createProvider(server, { displayName: '流式', baseUrl: upstream.url });

    const response = await post(server, '/api/chat', chatBody(provider));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    let state = createAppStreamState('openai-compatible');
    const events: string[] = [];
    const frames = await readSse(response, (frame) => {
      events.push(frame.event);
      state = consumeAppStreamFrame(state, { event: frame.event, data: frame.data });
    });
    // 前端状态机的全部约束（started 首帧且仅一次、终态后无事件、未知事件报错）都隐含在这里
    expect(events[0]).toBe(APP_STREAM_EVENTS.started);
    expect(events[events.length - 1]).toBe(APP_STREAM_EVENTS.completed);
    expect(events.filter((event) => event === APP_STREAM_EVENTS.started)).toHaveLength(1);
    expect(state.status).toBe('completed');
    expect(state.content).toBe('你好世界');
    expect(state.reasoning).toBe('想');
    expect(state.reasoningKind).toBe('thinking');
    expect(state.usage).toEqual({ inputTokens: 3, outputTokens: 2, totalTokens: 5, estimated: false });
    expect(state.finishReason).toBe('stop');
    // usage 只出现一次（投影器去重）
    expect(events.filter((event) => event === APP_STREAM_EVENTS.usage)).toHaveLength(1);
    void frames;
  });

  it('非流式：返回与前端 normalizeProviderResponse 对齐的 JSON', async () => {
    const server = await boot();
    const upstream = await bootMockUpstream((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        choices: [{ message: { role: 'assistant', content: '答案', reasoning_content: '推理' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 }
      }));
    });
    const provider = await createProvider(server, { displayName: '非流式', baseUrl: upstream.url });
    const response = await post(server, '/api/chat', chatBody(provider, { chatConfig: { ...CHAT_CONFIG, streaming: false }, stream: false }));
    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ content: '答案', reasoning: '推理', reasoningKind: 'thinking', skippedAttachments: [] });
    expect(payload.usage).toMatchObject({ inputTokens: 4, outputTokens: 1, totalTokens: 5, estimated: false });
  });

  it('压缩：使用固定内置指令（不含人格提示词），返回摘要与用量', async () => {
    const server = await boot();
    let upstreamSystem = '';
    const upstream = await bootMockUpstream((req, res, body) => {
      const parsed = JSON.parse(body) as { messages: Array<{ role: string; content: string }> };
      upstreamSystem = parsed.messages[0]?.role === 'system' ? parsed.messages[0].content : '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '压缩后的上下文摘要' } }] }));
    });
    const provider = await createProvider(server, { displayName: '压缩', baseUrl: upstream.url });
    const response = await post(server, '/api/chat/compress', {
      provider: { id: provider.id, displayName: provider.displayName, baseUrl: provider.baseUrl, responseFormat: provider.responseFormat },
      model: 'm1',
      contextSummary: '',
      messages: [{ role: 'user', content: '第一轮' }, { role: 'assistant', content: '第一答' }]
    });
    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.summary).toBe('压缩后的上下文摘要');
    expect(upstreamSystem).toContain('你是对话上下文压缩器');
    expect(upstreamSystem).not.toContain('Clawbox'); // 不夹带产品人格
  });

  it('校验与错误路径：400/401/404/409 与上游状态码转发', async () => {
    const server = await boot();
    const upstream = await bootMockUpstream((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(sseChunk({ choices: [{ delta: { content: 'ok' } }] }));
    });
    const provider = await createProvider(server, { displayName: '错误路径', baseUrl: upstream.url });
    await createProvider(server, { displayName: '停用', baseUrl: upstream.url, enabled: false });

    expect((await post(server, '/api/chat', chatBody(provider, { provider: { displayName: '不存在', baseUrl: upstream.url } }))).status).toBe(404);
    expect((await post(server, '/api/chat', chatBody(provider, { provider: { displayName: '停用', baseUrl: upstream.url } }))).status).toBe(409);
    expect((await post(server, '/api/chat', chatBody(provider, { model: '' }))).status).toBe(400);
    expect((await post(server, '/api/chat', chatBody(provider, { messages: [] }))).status).toBe(400);
    expect((await post(server, '/api/chat', chatBody(provider, { messages: [{ role: 'system', content: 'x' }] }))).status).toBe(400);
    expect((await post(server, '/api/chat', chatBody(provider, { chatConfig: { ...CHAT_CONFIG, version: 2 } }))).status).toBe(400);
    const extensions = await post(server, '/api/chat', chatBody(provider, { extensions: { tools: [], skills: [], sandbox: true, codeInterpreter: false } }));
    expect(extensions.status).toBe(400);
    expect(((await extensions.json()) as any).error).toContain('未启用');
    // 上游 401 转发状态码与信息
    const rejecting = await bootMockUpstream((req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Invalid API key' } }));
    });
    const rejectProvider = await createProvider(server, { displayName: '拒绝', baseUrl: rejecting.url });
    const rejected = await post(server, '/api/chat', chatBody(rejectProvider));
    expect(rejected.status).toBe(401);
    expect(((await rejected.json()) as any).error).toContain('Invalid API key');
  });

  it('流式请求上游返回非 SSE 时 502；预算冲突返回 400', async () => {
    const server = await boot();
    const jsonUpstream = await bootMockUpstream((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
    const jsonProvider = await createProvider(server, { displayName: '伪流', baseUrl: jsonUpstream.url });
    // 非 SSE 上游必然触发网关 5xx 日志：捕获为测试 Logger，隔离预期输出并断言错误对象。
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
      expect((await post(server, '/api/chat', chatBody(jsonProvider))).status).toBe(502);
    } finally {
      errorSpy.mockRestore();
    }
    expect(gatewayErrors.some((entry) => entry.status === 502 && String(entry.message).length > 0)).toBe(true);

    const tightProvider = await createProvider(server, { displayName: '紧预算', baseUrl: jsonUpstream.url, contextWindow: 1000 });
    const tight = await post(server, '/api/chat', chatBody(tightProvider, {
      chatConfig: { ...CHAT_CONFIG, inputBudget: null }
    }));
    expect(tight.status).toBe(400);
    expect(((await tight.json()) as any).error).toContain('预算');
  });

  it('客户端取消会中止上游请求；上游中断经 chat.stream.error 收尾', async () => {
    const server = await boot();
    let upstreamClosed: () => void = () => {};
    const upstreamClosedPromise = new Promise<void>((resolve) => { upstreamClosed = resolve; });
    const upstream = await bootMockUpstream((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(sseChunk({ choices: [{ delta: { content: '开始' } }] }));
      req.on('close', () => upstreamClosed());
      // 故意不结束响应
    });
    const provider = await createProvider(server, { displayName: '取消', baseUrl: upstream.url });
    const controller = new AbortController();
    const response = await post(server, '/api/chat', chatBody(provider), { signal: controller.signal });
    const reader = response.body!.getReader();
    await reader.read(); // 读到至少一个 chunk
    controller.abort();
    const result = await Promise.race([
      upstreamClosedPromise.then(() => 'closed'),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 2000))
    ]);
    expect(result).toBe('closed'); // 客户端取消必须传播到上游连接

    // 上游中途断开：后端以 chat.stream.error 事件收尾，不悬挂
    const crashing = await bootMockUpstream((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(sseChunk({ choices: [{ delta: { content: '半' } }] }));
      setTimeout(() => res.destroy(), 50); // 让首块先送达，再模拟中途断开
    });
    const crashProvider = await createProvider(server, { displayName: '中断', baseUrl: crashing.url });
    const crashResponse = await post(server, '/api/chat', chatBody(crashProvider));
    const crashFrames = await readSse(crashResponse);
    const last = crashFrames[crashFrames.length - 1];
    expect(last.event).toBe(APP_STREAM_EVENTS.error);
    expect(JSON.parse(last.data).message.length).toBeGreaterThan(0);
  });
});
