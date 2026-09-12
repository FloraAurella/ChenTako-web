import type { ResponseFormat } from '../../../contracts/limits.ts';
import { APP_STREAM_EVENTS, type ReasoningKind, type NormalizedResponse } from '../../../contracts/protocol.ts';
import { normalizeUpstreamJson, normalizeUsage } from '../domain/normalize.ts';
import { readUpstreamSse, type UpstreamSseFrame } from './sse.ts';

/**
 * 四协议上游流 → 统一应用事件（原版 lib/provider-stream.ts + lib/app-stream.ts 移植）。
 * 每轮先把原生 SSE 累积重建为完整 payload（供非流式语义复用），
 * 同时增量投影为稳定的 chat.* 事件流。
 */
type JsonRecord = Record<string, unknown>;

export interface StreamProjectorEvent {
  event: string;
  data: JsonRecord;
}
type Emit = (event: StreamProjectorEvent) => void | Promise<void>;

function appendText(target: JsonRecord, key: string, value: unknown): void {
  if (typeof value !== 'string' || !value) return;
  target[key] = String(target[key] || '') + value;
}

function parseJson(data: string): JsonRecord | null {
  if (!data || data === '[DONE]') return null;
  try {
    const parsed: unknown = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed as JsonRecord : null;
  } catch {
    return null;
  }
}

// ---- 每协议累积器：把原生增量帧重建为完整 payload ----

function createCompatibleAccumulator() {
  const message: JsonRecord = { role: 'assistant', content: '' };
  let finishReason: unknown = null;
  let usage: JsonRecord | null = null;
  const toolCall = (delta: JsonRecord): void => {
    const calls = message.tool_calls as JsonRecord[] || (message.tool_calls = []);
    const index = Number.isInteger(delta.index) ? Number(delta.index) : calls.length;
    const current = calls[index] || { id: '', type: 'function', function: { name: '', arguments: '' } };
    calls[index] = current;
    const callRecord = current as JsonRecord & { function: JsonRecord };
    appendText(callRecord, 'id', delta.id);
    if (delta.type) callRecord.type = delta.type;
    const fn = delta.function && typeof delta.function === 'object' ? delta.function as JsonRecord : {};
    appendText(callRecord.function, 'name', fn.name);
    appendText(callRecord.function, 'arguments', fn.arguments);
  };
  return {
    consume(payload: JsonRecord) {
      if (payload.usage && typeof payload.usage === 'object') usage = payload.usage as JsonRecord;
      const choices = Array.isArray(payload.choices) ? payload.choices as JsonRecord[] : [];
      const choice = choices[0];
      if (!choice || typeof choice !== 'object') return;
      if (choice.finish_reason !== undefined) finishReason = choice.finish_reason;
      if (choice.message && typeof choice.message === 'object') {
        Object.assign(message, choice.message);
        return;
      }
      const delta = choice.delta && typeof choice.delta === 'object' ? choice.delta as JsonRecord : {};
      if (delta.role) message.role = delta.role;
      if (typeof delta.content === 'string') appendText(message, 'content', delta.content);
      if (Array.isArray(delta.content)) {
        for (const block of delta.content) {
          if (block && typeof block === 'object' && typeof (block as JsonRecord).text === 'string') {
            appendText(message, 'content', (block as JsonRecord).text);
          }
        }
      }
      appendText(message, 'reasoning_content', delta.reasoning_content);
      appendText(message, 'reasoning', delta.reasoning);
    },
    payload(): JsonRecord {
      return {
        choices: [{ message, finish_reason: finishReason }],
        ...(usage ? { usage } : {})
      };
    }
  };
}

function createAnthropicAccumulator() {
  const message: JsonRecord = { role: 'assistant', content: [] as JsonRecord[], usage: {} };
  const blocks = message.content as JsonRecord[];
  return {
    consume(payload: JsonRecord) {
      if (payload.type === 'message_start' && payload.message && typeof payload.message === 'object') {
        Object.assign(message, payload.message, { content: blocks });
        const startUsage = (payload.message as JsonRecord).usage;
        if (startUsage) message.usage = { ...(startUsage as JsonRecord) };
        return;
      }
      if (payload.type === 'content_block_start' && payload.content_block) {
        blocks[Number(payload.index) || 0] = { ...(payload.content_block as JsonRecord) };
        return;
      }
      if (payload.type === 'content_block_delta' && payload.delta) {
        const index = Number(payload.index) || 0;
        const block = blocks[index] || (blocks[index] = { type: 'text', text: '' });
        const blockRecord = block as JsonRecord;
        const delta = payload.delta as JsonRecord;
        if (delta.type === 'text_delta') appendText(blockRecord, 'text', delta.text);
        if (delta.type === 'thinking_delta') appendText(blockRecord, 'thinking', delta.thinking);
        if (delta.type === 'signature_delta') appendText(blockRecord, 'signature', delta.signature);
        if (delta.type === 'input_json_delta') appendText(blockRecord, '__partialJson', delta.partial_json);
        return;
      }
      if (payload.type === 'content_block_stop') {
        const block = blocks[Number(payload.index) || 0] as JsonRecord | undefined;
        if (block && block.type === 'tool_use' && typeof block.__partialJson === 'string') {
          try { block.input = JSON.parse(block.__partialJson || '{}'); } catch { block.input = {}; }
          delete block.__partialJson;
        }
        return;
      }
      if (payload.type === 'message_delta') {
        if (payload.delta && typeof payload.delta === 'object') Object.assign(message, payload.delta);
        if (payload.usage && typeof payload.usage === 'object') {
          message.usage = { ...(message.usage as JsonRecord), ...(payload.usage as JsonRecord) };
        }
      }
    },
    payload(): JsonRecord {
      return { ...message, content: blocks.filter(Boolean) };
    }
  };
}

function createResponsesAccumulator() {
  let response: JsonRecord = { output: [] };
  const items = new Map<number, JsonRecord>();
  const itemAt = (payload: JsonRecord, type = 'message'): JsonRecord => {
    const index = Number.isInteger(payload.output_index) ? Number(payload.output_index) : 0;
    const existing = items.get(index);
    if (existing) return existing;
    const created: JsonRecord = payload.item && typeof payload.item === 'object'
      ? { ...(payload.item as JsonRecord) }
      : { id: String(payload.item_id || ''), type };
    items.set(index, created);
    return created;
  };
  const contentPart = (payload: JsonRecord, type: string): JsonRecord => {
    const item = itemAt(payload, 'message');
    const content = Array.isArray(item.content) ? item.content as JsonRecord[] : (item.content = []);
    const index = Number.isInteger(payload.content_index) ? Number(payload.content_index) : 0;
    return content[index] || (content[index] = { type, text: '' });
  };
  const summaryPart = (payload: JsonRecord): JsonRecord => {
    const item = itemAt(payload, 'reasoning');
    item.type = 'reasoning';
    const summary = Array.isArray(item.summary) ? item.summary as JsonRecord[] : (item.summary = []);
    const index = Number.isInteger(payload.summary_index) ? Number(payload.summary_index) : 0;
    return summary[index] || (summary[index] = { type: 'summary_text', text: '' });
  };
  return {
    consume(payload: JsonRecord) {
      const type = String(payload.type || '');
      if ((type === 'response.created' || type === 'response.in_progress') && payload.response) {
        response = { ...response, ...(payload.response as JsonRecord) };
      }
      if (type === 'response.output_item.added' && payload.item) Object.assign(itemAt(payload, (payload.item as JsonRecord).type as string), payload.item);
      if (type === 'response.output_item.done' && payload.item) Object.assign(itemAt(payload, (payload.item as JsonRecord).type as string), payload.item);
      if (type === 'response.output_text.delta') appendText(contentPart(payload, 'output_text'), 'text', payload.delta);
      if (type === 'response.output_text.done') (contentPart(payload, 'output_text') as JsonRecord).text = String(payload.text || '');
      if (type === 'response.refusal.delta') appendText(contentPart(payload, 'refusal'), 'refusal', payload.delta);
      if (type === 'response.refusal.done') (contentPart(payload, 'refusal') as JsonRecord).refusal = String(payload.refusal || '');
      if (type === 'response.reasoning_summary_text.delta') appendText(summaryPart(payload), 'text', payload.delta);
      if (type === 'response.reasoning_summary_text.done') (summaryPart(payload) as JsonRecord).text = String(payload.text || '');
      if (type === 'response.completed' || type === 'response.incomplete' || type === 'response.failed') {
        if (payload.response && typeof payload.response === 'object') response = payload.response as JsonRecord;
      }
    },
    payload(): JsonRecord {
      if (Array.isArray(response.output) && response.output.length) return response;
      return {
        ...response,
        output: [...items.entries()].sort(([a], [b]) => a - b).map(([, item]) => item)
      };
    }
  };
}

function createGoogleAccumulator() {
  const partsByIndex = new Map<number, JsonRecord>();
  let finishReason: unknown = null;
  let usage: JsonRecord | null = null;
  return {
    consume(payload: JsonRecord) {
      if (payload.usageMetadata && typeof payload.usageMetadata === 'object') usage = payload.usageMetadata as JsonRecord;
      const candidates = Array.isArray(payload.candidates) ? payload.candidates as JsonRecord[] : [];
      const candidate = candidates[0];
      if (!candidate || typeof candidate !== 'object') return;
      if (candidate.finishReason !== undefined) finishReason = candidate.finishReason;
      const content = candidate.content as JsonRecord | undefined;
      const parts = content && Array.isArray(content.parts) ? content.parts as JsonRecord[] : [];
      parts.forEach((part, index) => {
        if (!part || typeof part !== 'object') return;
        const block = part as JsonRecord;
        const previous = partsByIndex.get(index) || {};
        if (typeof block.text === 'string') {
          const prevText = String(previous.text || '');
          const isThought = block.thought === true;
          if (prevText && !block.text.startsWith(prevText)) {
            // Gemini 2.5 思考 part 结束后正文可能复用同一 index：视为新 part 整段消费；
            // 同类分片非前缀（异常流）则跳过，避免内容重复
            if (Boolean(previous.thought) === isThought) return;
          }
          partsByIndex.set(index, { text: block.text, ...(isThought ? { thought: true } : {}) });
          return;
        }
        if (block.functionCall && typeof block.functionCall === 'object') {
          partsByIndex.set(index, { ...previous, functionCall: block.functionCall });
        }
      });
    },
    payload(): JsonRecord {
      const parts = [...partsByIndex.entries()].sort(([a], [b]) => a - b).map(([, part]) => part);
      return {
        candidates: [{ content: { role: 'model', parts }, finishReason }],
        ...(usage ? { usageMetadata: usage } : {})
      };
    }
  };
}

function createAccumulator(format: ResponseFormat) {
  if (format === 'anthropic') return createAnthropicAccumulator();
  if (format === 'responses') return createResponsesAccumulator();
  if (format === 'google') return createGoogleAccumulator();
  return createCompatibleAccumulator();
}

export async function collectProviderStreamRound(
  upstreamBody: ReadableStream<Uint8Array> | null | undefined,
  responseFormat: ResponseFormat,
  onFrame: (frame: UpstreamSseFrame) => void | Promise<void>
): Promise<{ payload: JsonRecord }> {
  const accumulator = createAccumulator(responseFormat);
  await readUpstreamSse(upstreamBody, async (frame) => {
    await onFrame(frame);
    if (!frame.hasData) return;
    const payload = parseJson(frame.data);
    if (payload) accumulator.consume(payload);
  });
  return { payload: accumulator.payload() };
}

// ---- 投影器：原生 payload 增量 → 稳定 chat.* 应用事件 ----

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function contentText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value
    .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' &&
      ['text', 'output_text'].includes(String((item as JsonRecord).type || '')))
    .map((item) => stringOf(item.text))
    .join('');
}

function outputEvent(payload: JsonRecord, format: ResponseFormat): StreamProjectorEvent | null {
  const normalized: NormalizedResponse = normalizeUpstreamJson(payload, format);
  if (!normalized.images.length && !normalized.files.length) return null;
  return {
    event: APP_STREAM_EVENTS.output,
    data: {
      ...(normalized.images.length ? { images: normalized.images } : {}),
      ...(normalized.files.length ? { files: normalized.files } : {})
    }
  };
}

export function finishReasonOf(payload: JsonRecord, format: ResponseFormat): string {
  if (format === 'anthropic') return stringOf(payload.stop_reason);
  if (format === 'responses') {
    if (payload.error) return 'failed';
    const incomplete = payload.incomplete_details as JsonRecord | undefined;
    return stringOf(payload.status || incomplete?.reason);
  }
  if (format === 'google') {
    const candidates = Array.isArray(payload.candidates) ? payload.candidates as JsonRecord[] : [];
    return stringOf(candidates[0]?.finishReason);
  }
  const choices = Array.isArray(payload.choices) ? payload.choices as JsonRecord[] : [];
  return stringOf(choices[0]?.finish_reason);
}

export function createProviderStreamProjector(
  responseFormat: ResponseFormat,
  emit: Emit,
  { emitUsage = true }: { emitUsage?: boolean } = {}
) {
  const googleParts = new Map<number, { text: string; thought: boolean }>();
  let usageSignature = '';
  const send = async (event: string, data: JsonRecord): Promise<void> => { await emit({ event, data }); };
  const sendContent = async (delta: unknown): Promise<void> => {
    const text = stringOf(delta);
    if (text) await send(APP_STREAM_EVENTS.contentDelta, { delta: text });
  };
  const sendReasoning = async (delta: unknown, kind: ReasoningKind = 'thinking'): Promise<void> => {
    const text = stringOf(delta);
    if (text) await send(APP_STREAM_EVENTS.reasoningDelta, { delta: text, kind });
  };
  const sendUsage = async (payload: JsonRecord): Promise<void> => {
    if (!emitUsage) return;
    const usage = normalizeUsage(payload, responseFormat);
    if (!usage) return;
    const data = {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimated: usage.estimated === true
    };
    const signature = JSON.stringify(data);
    if (signature === usageSignature) return;
    usageSignature = signature;
    await emit({ event: APP_STREAM_EVENTS.usage, data });
  };

  async function consumeCompatible(payload: JsonRecord): Promise<void> {
    const choices = Array.isArray(payload.choices) ? payload.choices as JsonRecord[] : [];
    const choice = choices[0];
    if (!choice || typeof choice !== 'object') return;
    const delta = choice.delta && typeof choice.delta === 'object'
      ? choice.delta as JsonRecord
      : choice.message && typeof choice.message === 'object' ? choice.message as JsonRecord : {};
    await sendReasoning(delta.reasoning_content || delta.reasoning, 'thinking');
    await sendContent(contentText(delta.content));
  }

  async function consumeAnthropic(payload: JsonRecord): Promise<void> {
    if (payload.type === 'content_block_start' && payload.content_block) {
      const block = payload.content_block as JsonRecord;
      if (block.type === 'thinking') await sendReasoning(block.thinking, 'thinking');
      if (block.type === 'text') await sendContent(block.text);
      return;
    }
    if (payload.type !== 'content_block_delta' || !payload.delta) return;
    const delta = payload.delta as JsonRecord;
    if (delta.type === 'thinking_delta') await sendReasoning(delta.thinking, 'thinking');
    if (delta.type === 'text_delta') await sendContent(delta.text);
  }

  async function consumeResponses(payload: JsonRecord): Promise<void> {
    const type = stringOf(payload.type);
    if (['response.output_text.delta', 'response.refusal.delta'].includes(type)) {
      await sendContent(payload.delta);
    }
    if (['response.reasoning_summary_text.delta', 'response.reasoning_text.delta'].includes(type)) {
      await sendReasoning(payload.delta, 'summary');
    }
    if (type === 'response.output_item.done' && payload.item) {
      const output = outputEvent({ output: [payload.item] }, 'responses');
      if (output) await emit(output);
    }
  }

  async function consumeGoogle(payload: JsonRecord): Promise<void> {
    const candidates = Array.isArray(payload.candidates) ? payload.candidates as JsonRecord[] : [];
    const content = candidates[0]?.content as JsonRecord | undefined;
    const parts = content && Array.isArray(content.parts) ? content.parts as JsonRecord[] : [];
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (!part || typeof part !== 'object') continue;
      if (typeof part.text === 'string') {
        const thought = part.thought === true;
        const previous = googleParts.get(index);
        let delta = part.text;
        if (previous && previous.thought === thought && part.text.startsWith(previous.text)) {
          delta = part.text.slice(previous.text.length);
        }
        if (previous && previous.thought === thought && previous.text && !part.text.startsWith(previous.text)) {
          delta = '';
        }
        googleParts.set(index, { text: part.text, thought });
        if (thought) await sendReasoning(delta, 'thinking');
        else await sendContent(delta);
      }
      if (part.inlineData || part.fileData) {
        const output = outputEvent({ candidates: [{ content: { parts: [part] } }] }, 'google');
        if (output) await emit(output);
      }
    }
  }

  return {
    async consume(frame: UpstreamSseFrame): Promise<void> {
      if (!frame.hasData || frame.data === '[DONE]') return;
      if (frame.event === 'error') {
        const payload = parseJson(frame.data) || {};
        throw new Error(stringOf(payload.message || (payload.error as JsonRecord | undefined)?.message || payload.error) || '上游请求失败');
      }
      const payload = parseJson(frame.data);
      if (!payload) return;
      if (responseFormat === 'responses' && payload.type === 'response.failed') {
        const response = payload.response as JsonRecord | undefined;
        const error = response?.error as JsonRecord | undefined;
        throw new Error(stringOf(error?.message || payload.error) || 'OpenAI Responses 流失败');
      }
      if (responseFormat === 'anthropic') await consumeAnthropic(payload);
      else if (responseFormat === 'responses') await consumeResponses(payload);
      else if (responseFormat === 'google') await consumeGoogle(payload);
      else await consumeCompatible(payload);
      await sendUsage(payload);
    },
    async emitFinal(payload: JsonRecord, includeOutput = true): Promise<void> {
      if (includeOutput) {
        const output = outputEvent(payload, responseFormat);
        if (output) await emit(output);
      }
      await sendUsage(payload);
    },
    finishReason(payload: JsonRecord): string {
      return finishReasonOf(payload, responseFormat);
    }
  };
}
