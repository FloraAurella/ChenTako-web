// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildUpstreamRequest, ContextBudgetError, type MergedProvider } from '../../server/modules/upstream/domain/request-builder.ts';
import { normalizeUpstreamJson } from '../../server/modules/upstream/domain/normalize.ts';
import { resolveThinkingConfig } from '../../server/modules/upstream/domain/effort.ts';
import { validateUpstreamUrl, isLoopbackBaseUrl } from '../../server/modules/upstream/domain/ssrf.ts';
import { readUpstreamSse } from '../../server/modules/upstream/services/sse.ts';
import { collectProviderStreamRound, createProviderStreamProjector } from '../../server/modules/upstream/services/provider-stream.ts';
import { extractModelIds, protocolHeaders } from '../../server/modules/upstream/services/models.ts';

function provider(overrides: Partial<MergedProvider> = {}): MergedProvider {
  return {
    id: 'p1', displayName: '测试', enabled: true, keyEnv: 'test',
    baseUrl: 'https://api.example.com/v1', responseFormat: 'openai-compatible',
    defaultReasoningEffort: '', defaultModel: 'm1', models: ['m1'],
    modelCapabilities: {}, modelOverrides: {}, maxTokens: 4096, contextWindow: 131072,
    temperature: 0.7, topP: 1, streaming: true, saveChats: true, systemPrompt: '你是助手', userId: '',
    ...overrides
  };
}
const messages = [{ role: 'user', content: '你好' }];
const bodyOf = (request: { options: { body: string } }) => JSON.parse(request.options.body) as Record<string, any>;

describe('四协议请求构造', () => {
  it('openai-compatible：system 消息、参数、reasoning_effort 三档映射', () => {
    const request = buildUpstreamRequest(provider(), { model: 'm1', reasoningEffort: 'max', stream: false, messages, contextSummary: '此前摘要' });
    expect(request.url).toBe('https://api.example.com/v1/chat/completions');
    expect(request.options.headers['Authorization']).toBeUndefined(); // 无 Key 不带头
    const body = bodyOf(request);
    expect(body.max_tokens).toBe(4096);
    expect(body.reasoning_effort).toBe('high'); // max → 三档 high
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('你是助手');
    expect(body.messages[0].content).toContain('此前摘要');
    expect(body.messages[1]).toEqual({ role: 'user', content: '你好' });
  });

  it('anthropic：system 独立顶层字段，thinking 启用时 temperature 省略且 budget 收敛', () => {
    const request = buildUpstreamRequest(provider({ responseFormat: 'anthropic', apiKey: 'k', maxTokens: 20000 }), { model: 'm1', reasoningEffort: 'xhigh', stream: true, messages });
    expect(request.url).toBe('https://api.example.com/v1/messages');
    expect(request.options.headers['x-api-key']).toBe('k');
    expect(request.options.headers['anthropic-version']).toBe('2023-06-01');
    void 0;
    const body = bodyOf(request);
    expect(body.system).toBe('你是助手');
    expect(body.stream).toBe(true);
    expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 16384 });
    expect(body.temperature).toBeUndefined();
    expect(body.max_tokens).toBe(20000);
    // budget_tokens 必须小于 max_tokens
    const tight = bodyOf(buildUpstreamRequest(provider({ responseFormat: 'anthropic', maxTokens: 4096, temperature: 0.7 }), { model: 'm1', reasoningEffort: 'max', stream: false, messages }));
    expect(tight.thinking.budget_tokens).toBe(4095);
  });

  it('responses：input 数组、reasoning.effort 与 summary=auto', () => {
    const request = buildUpstreamRequest(provider({ responseFormat: 'responses', apiKey: 'k' }), { model: 'm1', reasoningEffort: 'high', stream: false, messages });
    expect(request.url).toBe('https://api.example.com/v1/responses');
    const body = bodyOf(request);
    expect(body.max_output_tokens).toBe(4096);
    expect(body.reasoning).toEqual({ effort: 'high', summary: 'auto' });
    expect(body.input[0].role).toBe('system');
    expect(body.input[1].content).toBe('你好');
  });

  it('google：模型名进 URL 路径，systemInstruction 独立，thinkingConfig 预算', () => {
    const stream = buildUpstreamRequest(provider({ responseFormat: 'google', apiKey: 'k' }), { model: 'gemini-2.5', reasoningEffort: 'max', stream: true, messages });
    expect(stream.url).toBe('https://api.example.com/v1/models/gemini-2.5:streamGenerateContent?alt=sse');
    const nonStream = buildUpstreamRequest(provider({ responseFormat: 'google' }), { model: 'gemini-2.5', reasoningEffort: 'max', stream: false, messages });
    expect(nonStream.url).toBe('https://api.example.com/v1/models/gemini-2.5:generateContent');
    const body = bodyOf(stream);
    expect(body.systemInstruction).toEqual({ parts: [{ text: '你是助手' }] });
    expect(body.generationConfig.maxOutputTokens).toBe(4096);
    expect(body.generationConfig.temperature).toBeUndefined();
    expect(body.thinkingConfig).toEqual({ thinkingBudget: 65536 });
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: '你好' }] }]);
  });

  it('思考强度例外：none 不携带、deepseek-reasoner 自管推理、gemini-2.0 不支持 thinkingConfig', () => {
    const none = bodyOf(buildUpstreamRequest(provider(), { model: 'm1', reasoningEffort: 'none', stream: false, messages }));
    expect(none.reasoning_effort).toBeUndefined();
    const deepseek = bodyOf(buildUpstreamRequest(provider({ baseUrl: 'https://api.deepseek.com' }), { model: 'deepseek-reasoner', reasoningEffort: 'high', stream: false, messages }));
    expect(deepseek.reasoning_effort).toBeUndefined();
    const gemini = bodyOf(buildUpstreamRequest(provider({ responseFormat: 'google' }), { model: 'gemini-2.0-flash', reasoningEffort: 'high', stream: false, messages }));
    expect(gemini.thinkingConfig).toBeUndefined();
    expect(resolveThinkingConfig('unknown', 'openai-compatible', 'm').reasoningEffort).toBe('high');
  });

  it('userId 按协议放置；google 不发送', () => {
    const anthropic = bodyOf(buildUpstreamRequest(provider({ responseFormat: 'anthropic', userId: 'u1' }), { model: 'm1', reasoningEffort: 'none', stream: false, messages }));
    expect(anthropic.metadata.user_id).toBe('u1');
    const openai = bodyOf(buildUpstreamRequest(provider({ userId: 'u1' }), { model: 'm1', reasoningEffort: 'none', stream: false, messages }));
    expect(openai.user).toBe('u1');
    const google = bodyOf(buildUpstreamRequest(provider({ responseFormat: 'google', userId: 'u1' }), { model: 'm1', reasoningEffort: 'none', stream: false, messages }));
    expect(google.user).toBeUndefined();
  });

  it('附件：文本并入正文，图片按协议成块，不支持的文件跳过并记录', () => {
    const rich = [{ role: 'user', content: '看图',
      files: [{ name: 'note.txt', text: '附件正文' }],
      parts: [
        { type: 'image', source: 'data:image/png;base64,AAAA' },
        { type: 'file', name: 'doc.pdf', mimeType: 'application/pdf', source: 'data:application/pdf;base64,BBBB' },
        { type: 'file', name: 'song.mp3', mimeType: 'audio/mpeg', source: 'data:audio/mpeg;base64,CCCC' },
        { type: 'file', name: 'file.bin', mimeType: 'application/octet-stream', source: 'data:application/octet-stream;base64,DDDD' }
      ] }];
    const openai = buildUpstreamRequest(provider(), { model: 'm1', reasoningEffort: 'none', stream: false, messages: rich });
    const openaiBody = bodyOf(openai);
    const userContent = openaiBody.messages[1].content;
    expect(Array.isArray(userContent)).toBe(true);
    expect((userContent as any[])[0].text).toContain('[附件：note.txt]');
    expect(JSON.stringify(userContent)).toContain('image_url');
    expect(JSON.stringify(userContent)).toContain('input_audio');
    expect(openai.skippedFiles.map((file) => file.name)).toEqual(['doc.pdf', 'file.bin']);

    const anthropic = bodyOf(buildUpstreamRequest(provider({ responseFormat: 'anthropic' }), { model: 'm1', reasoningEffort: 'none', stream: false, messages: rich }));
    const anthropicUser = anthropic.messages[0].content as Array<Record<string, any>>;
    expect(anthropicUser.some((block) => block.type === 'document')).toBe(true);

    const google = bodyOf(buildUpstreamRequest(provider({ responseFormat: 'google' }), { model: 'm1', reasoningEffort: 'none', stream: false, messages: rich }));
    const googleParts = google.contents[0].parts as Array<Record<string, any>>;
    expect(googleParts.some((part) => part.inlineData?.mimeType === 'application/pdf')).toBe(true);
    expect(googleParts.some((part) => part.inlineData?.mimeType === 'audio/mpeg')).toBe(true);
  });

  it('chatConfig 版本 1 时执行输入预算，超出抛 ContextBudgetError', () => {
    const tight = provider({ chatConfigVersion: 1, inputBudget: 10, contextWindow: 131072, maxTokens: 4096 });
    expect(() => buildUpstreamRequest(tight, { model: 'm1', reasoningEffort: 'none', stream: false, messages })).toThrow(ContextBudgetError);
    const legacy = provider({ chatConfigVersion: undefined, inputBudget: 10 });
    expect(() => buildUpstreamRequest(legacy, { model: 'm1', reasoningEffort: 'none', stream: false, messages })).not.toThrow();
  });
});

describe('非流式响应归一化', () => {
  it('anthropic：thinking/text 分离、图片 source 归一、用量字段映射', () => {
    const normalized = normalizeUpstreamJson({
      content: [
        { type: 'thinking', thinking: '思考' },
        { type: 'text', text: '回答' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUFB' } }
      ],
      usage: { input_tokens: 10, output_tokens: 5 }
    }, 'anthropic');
    expect(normalized.reasoning).toBe('思考');
    expect(normalized.content).toBe('回答');
    expect(normalized.reasoningKind).toBe('thinking');
    expect(normalized.images[0]).toMatchObject({ source: 'data:image/png;base64,QUFB', mimeType: 'image/png' });
    expect(normalized.usage).toMatchObject({ inputTokens: 10, outputTokens: 5, totalTokens: 15, estimated: false });
  });

  it('responses：summary 文本、message 输出、output_text 兜底', () => {
    const normalized = normalizeUpstreamJson({
      output: [
        { type: 'reasoning', summary: [{ type: 'summary_text', text: '摘要' }] },
        { type: 'message', content: [{ type: 'output_text', text: '正文' }] }
      ]
    }, 'responses');
    expect(normalized.reasoning).toBe('摘要');
    expect(normalized.content).toBe('正文');
    expect(normalized.reasoningKind).toBe('summary');
    const fallback = normalizeUpstreamJson({ output_text: '直出' }, 'responses');
    expect(fallback.content).toBe('直出');
  });

  it('google：thought part 与正文分离、inlineData 图片、candidatesTokenCount 用量', () => {
    const normalized = normalizeUpstreamJson({
      candidates: [{ content: { parts: [
        { text: '推理', thought: true },
        { text: '回答' },
        { inlineData: { mimeType: 'image/png', data: 'QUFB' } }
      ] } }],
      usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 }
    }, 'google');
    expect(normalized.reasoning).toBe('推理');
    expect(normalized.content).toBe('回答');
    expect(normalized.images).toHaveLength(1);
    expect(normalized.usage).toMatchObject({ inputTokens: 7, outputTokens: 3, totalTokens: 10 });
  });

  it('openai-compatible：choices.message、reasoning_content、b64_json 图片', () => {
    const normalized = normalizeUpstreamJson({
      choices: [{ message: { content: '答', reasoning_content: '想' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
    }, 'openai-compatible');
    expect(normalized.content).toBe('答');
    expect(normalized.reasoning).toBe('想');
    expect(normalized.usage).toMatchObject({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
  });
});

function sseResponse(frames: string[]): { body: ReadableStream<Uint8Array> } {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    }
  });
  return { body: stream };
}

function byteStream(chunks: Uint8Array[]): { body: ReadableStream<Uint8Array> } {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    }
  });
  return { body: stream };
}

describe('上游 SSE 解析与投影', () => {
  it('帧跨任意 chunk 与 UTF-8 字符边界时仍完整拆分，缺尾部空行时补全', async () => {
    const encoder = new TextEncoder();
    const frames: string[] = [];
    // "你好" 的 UTF-8 编码被从中间切成两个 chunk
    const you = encoder.encode('data: {"t":"你');
    const back = encoder.encode('好"}\n\ndata: {"t":"B"}\n\ndata: {"t":"C"}'); // 末帧缺空行
    await readUpstreamSse(byteStream([you, back]).body, (frame) => { frames.push(frame.data); });
    expect(frames).toEqual(['{"t":"你好"}', '{"t":"B"}', '{"t":"C"}']);
  });

  it('兼容 CRLF 与注释行', async () => {
    const frames: string[] = [];
    await readUpstreamSse(sseResponse([': ping\r\n\r\nevent: delta\r\ndata: {"a":1}\r\n\r\n']).body, (frame) => {
      if (frame.hasData) frames.push(`${frame.event}|${frame.data}`);
    });
    expect(frames).toEqual(['delta|{"a":1}']);
  });

  it('openai-compatible 流：reasoning/content 增量投影 + 用量去重 + payload 重建', async () => {
    const events: Array<{ event: string; data: any }> = [];
    const projector = createProviderStreamProjector('openai-compatible', (projection) => { events.push({ event: projection.event, data: JSON.parse(JSON.stringify(projection.data)) }); });
    const { payload } = await collectProviderStreamRound(sseResponse([
      'data: {"choices":[{"delta":{"reasoning_content":"想","content":""}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"好"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":3,"completion_tokens":2}}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":3,"completion_tokens":2}}\n\n',
      'data: [DONE]\n\n'
    ]).body, 'openai-compatible', async (frame) => { await projector.consume(frame); });
    expect(events.map((event) => event.event)).toEqual(['chat.reasoning.delta', 'chat.content.delta', 'chat.content.delta', 'chat.usage']);
    expect(events[0].data).toEqual({ delta: '想', kind: 'thinking' });
    expect(events[3].data).toMatchObject({ inputTokens: 3, outputTokens: 2, totalTokens: 5, estimated: false });
    expect((payload as any).choices[0].message.content).toBe('你好');
    expect(projector.finishReason(payload)).toBe('stop');
    await projector.emitFinal(payload, false);
    expect(events).toHaveLength(4); // emitFinal 的 usage 因去重不再发
  });

  it('anthropic 流：thinking_delta 与 text_delta 顺序投影，payload 重建 content blocks', async () => {
    const events: Array<{ event: string; data: any }> = [];
    const projector = createProviderStreamProjector('anthropic', (projection) => { events.push({ event: projection.event, data: JSON.parse(JSON.stringify(projection.data)) }); });
    const { payload } = await collectProviderStreamRound(sseResponse([
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":9}}}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"thinking"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"推理"}}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"text"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"答案"}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":4}}\n\n'
    ]).body, 'anthropic', async (frame) => { await projector.consume(frame); });
    expect(events.map((event) => event.event)).toEqual(['chat.reasoning.delta', 'chat.content.delta', 'chat.usage']);
    expect(events[1].data).toEqual({ delta: '答案' });
    expect((payload as any).stop_reason).toBe('end_turn');
    expect((payload as any).content.filter((block: any) => block.text).map((block: any) => block.text).join('')).toContain('答案');
  });

  it('responses 流：summary kind 标记与 image 产物事件', async () => {
    const events: Array<{ event: string; data: any }> = [];
    const projector = createProviderStreamProjector('responses', (projection) => { events.push({ event: projection.event, data: JSON.parse(JSON.stringify(projection.data)) }); });
    const { payload } = await collectProviderStreamRound(sseResponse([
      'data: {"type":"response.reasoning_summary_text.delta","delta":"概要"}\n\n',
      'data: {"type":"response.output_text.delta","delta":"正文"}\n\n',
      'data: {"type":"response.output_item.done","item":{"type":"image_generation_call","result":"QUFB"}}\n\n',
      'data: {"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":1,"output_tokens":1}}}\n\n'
    ]).body, 'responses', async (frame) => { await projector.consume(frame); });
    const kinds = events.filter((event) => event.event === 'chat.reasoning.delta').map((event) => event.data.kind);
    expect(kinds).toEqual(['summary']);
    const output = events.find((event) => event.event === 'chat.output');
    expect(output?.data.images[0].source).toBe('data:image/png;base64,QUFB');
    expect(projector.finishReason(payload)).toBe('completed');
  });

  it('google 流：累计文本转增量，思考 part 结束后正文整段消费', async () => {
    const events: Array<{ event: string; data: any }> = [];
    const projector = createProviderStreamProjector('google', (projection) => { events.push({ event: projection.event, data: JSON.parse(JSON.stringify(projection.data)) }); });
    const { payload } = await collectProviderStreamRound(sseResponse([
      'data: {"candidates":[{"content":{"parts":[{"text":"推理","thought":true}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"推理完","thought":true}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"index":0,"text":"回答"}]}}],"usageMetadata":{"promptTokenCount":2,"candidatesTokenCount":2}}\n\n',
      'data: {"candidates":[{"finishReason":"STOP","content":{"role":"model","parts":[]}}]}\n\n'
    ]).body, 'google', async (frame) => { await projector.consume(frame); });
    const reasoningDeltas = events.filter((event) => event.event === 'chat.reasoning.delta').map((event) => event.data.delta);
    expect(reasoningDeltas).toEqual(['推理', '完']);
    const contentDeltas = events.filter((event) => event.event === 'chat.content.delta').map((event) => event.data.delta);
    expect(contentDeltas).toEqual(['回答']);
    expect(projector.finishReason(payload)).toBe('STOP');
  });

  it('上游 error 帧与 response.failed 抛出可读错误', async () => {
    const projector = createProviderStreamProjector('openai-compatible', () => {});
    await expect(projector.consume({ event: 'error', data: '{"message":"余额不足"}', raw: '', hasData: true })).rejects.toThrow('余额不足');
    const responses = createProviderStreamProjector('responses', () => {});
    await expect(responses.consume({ event: '', data: '{"type":"response.failed","response":{"error":{"message":"失败"}}}', raw: '', hasData: true })).rejects.toThrow('失败');
  });
});

describe('模型列表与协议头', () => {
  it('extractModelIds 兼容 data/models 数组与去重排序', () => {
    expect(extractModelIds({ data: [{ id: 'b' }, { id: 'a' }, { id: 'a' }] })).toEqual(['a', 'b']);
    expect(extractModelIds({ models: ['m2', 'm1'] })).toEqual(['m1', 'm2']);
    expect(protocolHeaders('anthropic', 'k')).toMatchObject({ 'x-api-key': 'k', 'anthropic-version': '2023-06-01' });
    expect(protocolHeaders('google', 'k')).toEqual({ 'x-goog-api-key': 'k' });
    expect(protocolHeaders('openai-compatible', 'k')).toEqual({ Authorization: 'Bearer k' });
  });
});

describe('SSRF 防护', () => {
  it('默认拒绝回环与内网地址；允许列表放行', async () => {
    expect((await validateUpstreamUrl('http://127.0.0.1:8080/v1', [])).ok).toBe(false);
    expect((await validateUpstreamUrl('http://localhost/v1', [])).ok).toBe(false);
    expect((await validateUpstreamUrl('http://10.0.0.1/v1', [])).ok).toBe(false);
    expect((await validateUpstreamUrl('http://192.168.1.1/v1', [])).ok).toBe(false);
    expect((await validateUpstreamUrl('http://localhost/v1', ['localhost'])).ok).toBe(true);
    expect((await validateUpstreamUrl('ftp://x', [])).ok).toBe(false);
    expect((await validateUpstreamUrl('not a url', [])).ok).toBe(false);
    expect(isLoopbackBaseUrl('http://127.0.0.1:9/v1')).toBe(true);
    expect(isLoopbackBaseUrl('https://api.example.com')).toBe(false);
  });
});
