import type { ResponseFormat } from '../../../contracts/limits.ts';
import { DEFAULT_MAX_TOKENS } from '../../../contracts/limits.ts';
import type { ProviderRecord, WireMessage, MessageFile, MessagePart } from '../../../contracts/types.ts';
import type { SkippedAttachment } from '../../../contracts/protocol.ts';
import { resolveThinkingConfig } from './effort.ts';
import { enforceContextBudget, ContextBudgetError } from './context-budget.ts';

export { ContextBudgetError };

/**
 * 上游请求构造（原版 lib/upstream.ts 移植；一期不含工具/沙箱与 transcript 续接）。
 * 四种 responseFormat 共用同一个入口，返回 { url, options, skippedFiles }。
 */

type JsonRecord = Record<string, unknown>;
type ImagePart = MessagePart;
type FilePart = MessagePart;

/** 注册表记录合并 chatConfig 后的请求期形态。 */
export interface MergedProvider extends ProviderRecord {
  apiKey?: string;
  inputBudget?: number | null;
  chatConfigVersion?: number;
}

export interface UpstreamRequestArgs {
  model: string;
  reasoningEffort: unknown;
  stream: boolean;
  messages: WireMessage[];
  contextSummary?: string;
}

export interface UpstreamRequest {
  url: string;
  options: { method: 'POST'; headers: Record<string, string>; body: string };
  skippedFiles: SkippedAttachment[];
}

const MAX_FILE_PARTS_PER_MESSAGE = 8;
const FILE_SKIP_REASON = '当前供应商不支持该文件格式';

function composeSystemPrompt(systemPrompt: unknown, contextSummary: unknown): string {
  const parts: string[] = [];
  const configured = String(systemPrompt || '').trim();
  const compressed = String(contextSummary || '').trim();
  if (configured) parts.push(configured);
  if (compressed) {
    parts.push([
      '以下内容是此前对话的内部压缩上下文。请将它视为已经发生的对话事实与约束，',
      '用于延续当前任务；不要向用户提及压缩、摘要或这段内部说明。',
      compressed
    ].join('\n'));
  }
  return parts.join('\n\n');
}

function fileDataUrl(file: FilePart): { mimeType: string; data: string } | null {
  const match = String(file.source || '').match(
    /^data:([a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*);base64,([A-Za-z0-9+/=\s]+)$/i
  );
  if (!match) return null;
  return { mimeType: String(match[1]).toLowerCase(), data: String(match[2]).replace(/\s/g, '') };
}

function isFileRemoteUrl(source: string): boolean {
  return /^https:\/\/\S{1,4096}$/i.test(source) ||
    /^http:\/\/(?:127(?:\.\d{1,3}){3}|localhost)(?::\d+)?\/\S{0,4096}$/i.test(source);
}

/** OpenAI 系 input_audio 只接受 wav/mp3。 */
function audioFormatOf(mimeType: string): string {
  const mime = String(mimeType || '').split(';')[0]?.trim().toLowerCase() || '';
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return 'mp3';
  if (mime === 'audio/wav' || mime === 'audio/x-wav' || mime === 'audio/wave') return 'wav';
  return '';
}

function skippedFile(file: FilePart, reason: string): SkippedAttachment {
  return {
    name: String(file.name || '文件'),
    mimeType: String(file.mimeType || '').split(';')[0]?.trim() || 'application/octet-stream',
    reason
  };
}

function messageTextContent(item: WireMessage): string {
  const content = String(item?.content ?? '');
  const files = Array.isArray(item?.files) ? item.files : [];
  const fileText = files
    .filter((file): file is MessageFile => Boolean(file) && Boolean(file.name || file.text))
    .map((file) => `\n\n[附件：${String(file.name || '未命名文件')}]\n${String(file.text || '')}`)
    .join('\n');
  return fileText ? `${content}${fileText}` : content;
}

function messageImageParts(item: WireMessage): ImagePart[] {
  if (item?.role !== 'user') return [];
  return (Array.isArray(item?.parts) ? item.parts : [])
    .filter((part): part is ImagePart => part?.type === 'image' && typeof part.source === 'string')
    .slice(0, 4);
}

function messageFileParts(item: WireMessage): FilePart[] {
  if (item?.role !== 'user') return [];
  return (Array.isArray(item?.parts) ? item.parts : [])
    .filter((part): part is FilePart => part?.type === 'file' && typeof part.source === 'string')
    .slice(0, MAX_FILE_PARTS_PER_MESSAGE);
}

/**
 * 用户 file part 翻译为供应商原生块；不支持的组合跳过并记录（不发给模型，
 * 由前端如实告知用户）。anthropic 只支持 PDF；openai 系只支持 wav/mp3；
 * google 支持任意 mime。
 */
function filePartBlocks(
  item: WireMessage,
  responseFormat: ResponseFormat,
  skipped: SkippedAttachment[] | null
): JsonRecord[] {
  const blocks: JsonRecord[] = [];
  for (const file of messageFileParts(item)) {
    const mimeType = String(file.mimeType || '').split(';')[0]?.trim().toLowerCase() || '';
    const inline = fileDataUrl(file);
    if (responseFormat === 'anthropic') {
      if (mimeType === 'application/pdf') {
        if (inline) {
          blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: inline.data } });
        } else {
          const url = String(file.source || '');
          if (isFileRemoteUrl(url)) {
            blocks.push({ type: 'document', source: { type: 'url', url } });
          } else if (skipped) {
            skipped.push(skippedFile(file, 'PDF 附件无法解析'));
          }
        }
      } else if (skipped) {
        skipped.push(skippedFile(file, FILE_SKIP_REASON));
      }
      continue;
    }
    if (responseFormat === 'responses' || responseFormat === 'openai-compatible') {
      const format = audioFormatOf(mimeType);
      if (inline && format) {
        blocks.push(responseFormat === 'responses'
          ? { type: 'input_audio', data: inline.data, format }
          : { type: 'input_audio', input_audio: { data: inline.data, format } });
      } else if (skipped) {
        skipped.push(skippedFile(file, inline ? FILE_SKIP_REASON : '音频附件无法解析'));
      }
      continue;
    }
    if (inline) {
      blocks.push({ inlineData: { mimeType: inline.mimeType, data: inline.data } });
    } else {
      const url = String(file.source || '');
      if (isFileRemoteUrl(url)) {
        blocks.push({ fileData: { fileUri: url, mimeType: mimeType || 'application/octet-stream' } });
      } else if (skipped) {
        skipped.push(skippedFile(file, '文件附件无法解析'));
      }
    }
  }
  return blocks;
}

function multimodalContent(
  item: WireMessage,
  responseFormat: ResponseFormat,
  skipped?: SkippedAttachment[]
): string | JsonRecord[] {
  const text = messageTextContent(item);
  const images = messageImageParts(item);
  if (!images.length && !messageFileParts(item).length) return text;

  if (responseFormat === 'anthropic') {
    const blocks: JsonRecord[] = text ? [{ type: 'text', text }] : [];
    images.forEach((image) => {
      const match = String(image.source).match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/is);
      blocks.push(match
        ? { type: 'image', source: { type: 'base64', media_type: String(match[1]), data: String(match[2]).replace(/\s/g, '') } }
        : { type: 'image', source: { type: 'url', url: String(image.source) } });
    });
    blocks.push(...filePartBlocks(item, responseFormat, skipped ?? null));
    return blocks;
  }
  if (responseFormat === 'responses') {
    const blocks: JsonRecord[] = text ? [{ type: 'input_text', text }] : [];
    images.forEach((image) => blocks.push({ type: 'input_image', image_url: String(image.source) }));
    blocks.push(...filePartBlocks(item, responseFormat, skipped ?? null));
    return blocks;
  }
  const blocks: JsonRecord[] = text ? [{ type: 'text', text }] : [];
  images.forEach((image) => blocks.push({ type: 'image_url', image_url: { url: String(image.source) } }));
  blocks.push(...filePartBlocks(item, responseFormat, skipped ?? null));
  return blocks;
}

function buildMessages(
  systemPrompt: unknown,
  messages: WireMessage[],
  contextSummary: unknown,
  responseFormat: ResponseFormat,
  skipped?: SkippedAttachment[]
): Array<{ role: string; content: string | JsonRecord[] }> {
  const cleaned = messages
    .filter((item): item is WireMessage => Boolean(item) && (item.role === 'user' || item.role === 'assistant'))
    .map((item) => ({
      role: item.role as string,
      content: multimodalContent(item, responseFormat, skipped)
    }));
  const system = composeSystemPrompt(systemPrompt, contextSummary);
  if (system) cleaned.unshift({ role: 'system', content: system });
  return cleaned;
}

function googleImagePart(image: ImagePart): JsonRecord {
  const source = String(image.source || '');
  const match = source.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/is);
  if (match) {
    return { inlineData: { mimeType: String(match[1]), data: String(match[2]).replace(/\s/g, '') } };
  }
  const mimeMatch = source.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
  return { fileData: { fileUri: source, mimeType: mimeMatch ? String(mimeMatch[1]) : 'image/png' } };
}

/** Gemini 的 contents：role 只有 user / model，系统提示走独立顶层字段。 */
function buildGoogleContents(
  systemPrompt: unknown,
  messages: WireMessage[],
  contextSummary: unknown,
  skipped?: SkippedAttachment[]
): Array<{ role: string; parts: JsonRecord[] }> {
  const cleaned = messages
    .filter((item): item is WireMessage => Boolean(item) && (item.role === 'user' || item.role === 'assistant'))
    .map((item) => {
      const parts: JsonRecord[] = [];
      const text = messageTextContent(item);
      if (text) parts.push({ text });
      messageImageParts(item).forEach((image) => parts.push(googleImagePart(image)));
      parts.push(...filePartBlocks(item, 'google', skipped ?? null));
      if (!parts.length) parts.push({ text: '' });
      return { role: item.role === 'assistant' ? 'model' : 'user', parts };
    });
  return cleaned;
}

function buildUpstreamRequest(provider: MergedProvider, {
  model,
  reasoningEffort,
  stream,
  messages,
  contextSummary = ''
}: UpstreamRequestArgs): UpstreamRequest {
  enforceContextBudget(provider, { systemPrompt: provider.systemPrompt, contextSummary, messages });
  const baseUrl = String(provider.baseUrl || '').replace(/\/+$/, '');
  const format: ResponseFormat = provider.responseFormat || 'openai-compatible';
  const thinking = resolveThinkingConfig(reasoningEffort, format, model);
  const systemPrompt = String(provider.systemPrompt || '');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.apiKey) {
    if (format === 'anthropic') {
      headers['x-api-key'] = String(provider.apiKey);
      headers['anthropic-version'] = '2023-06-01';
    } else if (format === 'google') {
      headers['x-goog-api-key'] = String(provider.apiKey);
    } else {
      headers['Authorization'] = `Bearer ${String(provider.apiKey)}`;
    }
  }

  const temperature = thinking.enabled && format === 'anthropic' ? undefined : Number(provider.temperature);
  const topP = Number(provider.topP);
  const maxTokens = Number(provider.maxTokens) > 0 ? Math.floor(Number(provider.maxTokens)) : DEFAULT_MAX_TOKENS;

  let url = '';
  let body: JsonRecord;
  const skippedFiles: SkippedAttachment[] = [];

  if (format === 'anthropic') {
    url = `${baseUrl}/messages`;
    body = {
      model,
      max_tokens: maxTokens,
      messages: buildMessages('', messages, '', 'anthropic', skippedFiles), // system 是独立顶层字段
      stream: Boolean(stream)
    };
    const system = composeSystemPrompt(systemPrompt, contextSummary);
    if (system) body.system = system;
    if (Number.isFinite(topP)) body.top_p = topP;
    if (Number.isFinite(temperature) && !thinking.enabled) body.temperature = temperature;
    if (thinking.enabled) {
      // Anthropic 要求 budget_tokens < max_tokens，超出时收敛到安全值
      body.thinking = {
        type: 'enabled',
        budget_tokens: Math.min(thinking.budgetTokens ?? 0, Math.max(1, maxTokens - 1))
      };
    }
  } else if (format === 'responses') {
    url = `${baseUrl}/responses`;
    body = {
      model,
      input: buildMessages(systemPrompt, messages, contextSummary, 'responses', skippedFiles),
      stream: Boolean(stream),
      max_output_tokens: maxTokens
    };
    if (Number.isFinite(temperature)) body.temperature = temperature;
    if (Number.isFinite(topP)) body.top_p = topP;
    if (thinking.enabled) {
      // Responses API 只有显式请求 summary 才会发送可展示的推理摘要流。
      body.reasoning = { effort: thinking.reasoningEffort, summary: 'auto' };
    }
  } else if (format === 'google') {
    const endpoint = stream ? 'streamGenerateContent' : 'generateContent';
    url = `${baseUrl}/models/${encodeURIComponent(model)}:${endpoint}${stream ? '?alt=sse' : ''}`;
    body = {
      contents: buildGoogleContents(systemPrompt, messages, contextSummary, skippedFiles),
      generationConfig: { maxOutputTokens: maxTokens }
    };
    const system = composeSystemPrompt(systemPrompt, contextSummary);
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    if (Number.isFinite(temperature) && !thinking.enabled) (body.generationConfig as JsonRecord).temperature = temperature;
    if (Number.isFinite(topP) && !thinking.enabled) (body.generationConfig as JsonRecord).topP = topP;
    if (thinking.enabled) body.thinkingConfig = { thinkingBudget: thinking.budgetTokens };
  } else {
    url = `${baseUrl}/chat/completions`;
    body = {
      model,
      messages: buildMessages(systemPrompt, messages, contextSummary, 'openai-compatible', skippedFiles),
      stream: Boolean(stream),
      max_tokens: maxTokens
    };
    if (Number.isFinite(temperature)) body.temperature = temperature;
    if (Number.isFinite(topP)) body.top_p = topP;
    if (thinking.enabled) body.reasoning_effort = thinking.reasoningEffort;
  }

  if (provider.userId) {
    if (format === 'anthropic') {
      body.metadata = { ...(body.metadata && typeof body.metadata === 'object' ? body.metadata as JsonRecord : {}), user_id: String(provider.userId) };
    } else if (format !== 'google') {
      body.user = String(provider.userId);
    }
  }

  return {
    url,
    options: { method: 'POST', headers, body: JSON.stringify(body) },
    skippedFiles
  };
}

export { buildUpstreamRequest };
