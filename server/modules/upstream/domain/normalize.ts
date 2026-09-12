import type { ResponseFormat } from '../../../contracts/limits.ts';
import type { AppOutputFile, AppOutputImage, AppUsage, NormalizedResponse } from '../../../contracts/protocol.ts';

/**
 * 非流式上游响应归一化（原版 lib/upstream.ts 的 normalizeUpstreamJson 移植，
 * 与前端 normalizeProviderResponse 对齐）。
 */
type JsonRecord = Record<string, unknown>;

function normalizeTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  return content
    .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' &&
      ((item as JsonRecord).type === 'text' || (item as JsonRecord).type === 'output_text'))
    .map((item) => String(item.text ?? ''))
    .join('\n\n');
}

function normalizeOutputImageMime(value: unknown): string {
  const mime = String(value || 'image/png').toLowerCase();
  return ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime) ? mime : 'image/png';
}

/** Responses image_generation_call 常把 base64 放在 result；统一为可持久化 data URL。 */
function normalizeOutputImageSource(value: unknown, mimeType: unknown): string {
  const source = String(value || '').trim();
  if (!source) return '';
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(source)) return source;
  if (/^https?:\/\//i.test(source)) return source;
  const base64 = source.replace(/\s/g, '');
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(base64) && base64.length >= 4) {
    return `data:${normalizeOutputImageMime(mimeType)};base64,${base64}`;
  }
  return source;
}

/** 非图片 data URL 的近似字节数（与前端 imageByteSize 同公式）。 */
function fileDataUrlSize(value: string): number {
  const match = value.match(/^data:[^,]+;base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return value.length;
  const encoded = String(match[1]).replace(/\s/g, '');
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(encoded.length * 0.75) - padding);
}

const OUTPUT_FILE_BLOCK_TYPES = new Set([
  'document', 'file', 'audio', 'output_audio', 'output_file', 'file_url'
]);

function normalizeOutputFileSource(value: unknown, mimeType: unknown): string {
  const source = String(value || '').trim();
  if (!source) return '';
  if (/^data:[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*;base64,/i.test(source)) return source;
  if (/^https?:\/\//i.test(source)) return source;
  const base64 = source.replace(/\s/g, '');
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(base64) && base64.length >= 4) {
    const mime = String(mimeType || '').split(';')[0]?.trim().toLowerCase() || '';
    return `data:${mime || 'application/octet-stream'};base64,${base64}`;
  }
  return '';
}

function normalizeOutputFile(block: JsonRecord, fallbackName: string): AppOutputFile | null {
  const sourceObject = block.source && typeof block.source === 'object' ? block.source as JsonRecord : null;
  const fileData = block.file_data && typeof block.file_data === 'object' ? block.file_data as JsonRecord : null;
  const sourceValue = sourceObject?.data || sourceObject?.url || block.data || block.url ||
    block.file_url || fileData?.fileUri || fileData?.url || '';
  const mimeValue = block.mimeType || block.mime_type || sourceObject?.media_type ||
    fileData?.mimeType || fileData?.mime_type || '';
  const source = normalizeOutputFileSource(sourceValue, mimeValue);
  if (!source) return null;
  const mime = String(mimeValue || '').split(';')[0]?.trim().toLowerCase() || '';
  return {
    name: String(block.name || block.filename || fallbackName).slice(0, 200),
    mimeType: mime || (source.startsWith('data:') ? source.slice(5, source.indexOf(';')) : 'application/octet-stream'),
    source,
    size: Number(block.size) > 0 ? Number(block.size) : fileDataUrlSize(source)
  };
}

/** 从内容块/输出项中提取非图片文件（上限 8 个，按源去重）。 */
function outputFileBlocks(blocks: JsonRecord[]): AppOutputFile[] {
  const result: AppOutputFile[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    if (!block || !OUTPUT_FILE_BLOCK_TYPES.has(String(block.type || ''))) continue;
    const file = normalizeOutputFile(block, '模型返回的文件');
    if (!file || seen.has(file.source)) continue;
    seen.add(file.source);
    result.push(file);
    if (result.length >= 8) break;
  }
  return result;
}

function imageValue(value: unknown): unknown {
  if (value && typeof value === 'object') {
    const source = value as JsonRecord;
    return source.url || source.data || source.b64_json || '';
  }
  return value;
}

export function normalizeUsage(payload: JsonRecord, responseFormat: ResponseFormat): (AppUsage & { source: ResponseFormat }) | null {
  const usage = (payload?.usageMetadata || payload?.usage) as JsonRecord | undefined;
  if (!usage || typeof usage !== 'object') return null;
  const inputTokens = Number(
    usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens ?? usage.promptTokenCount ?? 0
  ) || 0;
  const outputTokens = Number(
    usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens ?? usage.candidatesTokenCount ?? 0
  ) || 0;
  const totalTokens = Number(
    usage.total_tokens ?? usage.totalTokens ?? usage.totalTokenCount ?? (inputTokens + outputTokens)
  ) || (inputTokens + outputTokens);
  if (!inputTokens && !outputTokens && !totalTokens) return null;
  return {
    inputTokens: Math.max(0, inputTokens),
    outputTokens: Math.max(0, outputTokens),
    totalTokens: Math.max(inputTokens + outputTokens, totalTokens),
    estimated: false,
    source: responseFormat
  };
}

function blockList(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object') : [];
}

export function normalizeUpstreamJson(payload: unknown, responseFormat: ResponseFormat): NormalizedResponse {
  const result: NormalizedResponse = {
    reasoning: '',
    content: '',
    images: [],
    files: [],
    reasoningKind: responseFormat === 'responses' ? 'summary' : 'thinking',
    usage: null
  };
  if (!payload || typeof payload !== 'object') return result;
  const source = payload as JsonRecord;
  result.usage = normalizeUsage(source, responseFormat);

  if (responseFormat === 'anthropic') {
    const blocks = blockList(source.content);
    result.reasoning = blocks
      .filter((block) => block?.type === 'thinking')
      .map((block) => String(block.thinking ?? ''))
      .filter(Boolean)
      .join('\n\n');
    result.content = blocks
      .filter((block) => block?.type === 'text')
      .map((block) => String(block.text ?? ''))
      .filter(Boolean)
      .join('\n\n');
    result.images = blocks
      .filter((block) => block?.type === 'image' && block?.source)
      .map((block) => {
        const imageSource = block.source as JsonRecord;
        return {
          source: normalizeOutputImageSource(imageSource.data || imageSource.url || '', imageSource.media_type),
          mimeType: normalizeOutputImageMime(imageSource.media_type || 'image/png'),
          alt: String(block.alt || '模型返回的图片')
        };
      });
    result.files = outputFileBlocks(blocks);
    return result;
  }

  if (responseFormat === 'responses') {
    const output = blockList(source.output);
    result.reasoning = output
      .filter((item) => item?.type === 'reasoning')
      .flatMap((item) => Array.isArray(item.summary) ? item.summary as JsonRecord[] : [])
      .filter((item) => item?.type === 'summary_text' || typeof item?.text === 'string')
      .map((item) => String(item.text ?? ''))
      .filter(Boolean)
      .join('\n\n');
    result.content = output
      .filter((item) => item?.type === 'message')
      .flatMap((item) => Array.isArray(item.content) ? item.content as JsonRecord[] : [])
      .filter((item) => item?.type === 'output_text' || item?.type === 'text')
      .map((item) => String(item.text ?? ''))
      .filter(Boolean)
      .join('\n\n');
    if (!result.content && typeof source.output_text === 'string') {
      result.content = source.output_text;
    }
    result.images = output
      .filter((item) => item?.type === 'image_generation_call' || item?.type === 'image')
      .map((item) => ({
        source: normalizeOutputImageSource(item.result || imageValue(item.image_url) || item.url || item.b64_json || '', item.mime_type),
        mimeType: normalizeOutputImageMime(item.mime_type || 'image/png'),
        alt: String(item.revised_prompt || '模型生成的图片')
      }));
    result.files = outputFileBlocks(output);
    return result;
  }

  if (responseFormat === 'google') {
    const candidates = Array.isArray(source.candidates) ? source.candidates as JsonRecord[] : [];
    const candidate = candidates[0] || null;
    const parts = candidate && candidate.content && typeof candidate.content === 'object' && Array.isArray((candidate.content as JsonRecord).parts)
      ? (candidate.content as JsonRecord).parts as JsonRecord[]
      : [];
    result.reasoning = parts
      .filter((part) => part?.thought === true && typeof part.text === 'string')
      .map((part) => String(part.text || ''))
      .filter(Boolean)
      .join('\n\n');
    result.content = parts
      .filter((part) => part?.thought !== true && typeof part.text === 'string')
      .map((part) => String(part.text || ''))
      .filter(Boolean)
      .join('\n\n');
    result.images = parts
      .filter((part) => part?.inlineData && typeof part.inlineData === 'object')
      .map((part) => {
        const inline = part.inlineData as JsonRecord;
        return {
          source: normalizeOutputImageSource(inline.data, inline.mimeType),
          mimeType: normalizeOutputImageMime(inline.mimeType || 'image/png'),
          alt: '模型返回的图片'
        };
      });
    result.files = parts
      .filter((part) => Boolean(part) && (
        (part.inlineData && typeof part.inlineData === 'object' && !/^image\//i.test(String((part.inlineData as JsonRecord).mimeType || ''))) ||
        (part.fileData && typeof part.fileData === 'object')))
      .map((part) => {
        const inline = part.inlineData as JsonRecord | undefined;
        const fileData = part.fileData as JsonRecord | undefined;
        return normalizeOutputFile({
          type: 'file',
          name: String(part.name || ''),
          mimeType: inline?.mimeType || fileData?.mimeType,
          data: inline?.data,
          url: fileData?.fileUri || fileData?.url,
          size: part.size
        }, '模型返回的文件');
      })
      .filter((file): file is AppOutputFile => Boolean(file));
    return result;
  }

  const choices = Array.isArray(source.choices) ? source.choices as JsonRecord[] : [];
  const message = (choices[0]?.message as JsonRecord | undefined) || (source.message as JsonRecord | undefined) || source;
  result.reasoning = String(
    message?.reasoning_content ||
    message?.reasoning ||
    source.reasoning_content ||
    ''
  );
  result.content = normalizeTextContent(message?.content ?? source.content ?? source.output_text ?? '');
  const blocks = blockList(message?.content);
  result.images = [
    ...blocks
      .filter((block) => ['image', 'image_url', 'output_image'].includes(String(block?.type || '')))
      .map((block) => ({
        source: normalizeOutputImageSource(
          imageValue(block.image_url) || block.url || (block.source as JsonRecord | undefined)?.data || block.b64_json || '',
          block.mime_type || (block.source as JsonRecord | undefined)?.media_type || 'image/png'
        ),
        mimeType: normalizeOutputImageMime(block.mime_type || (block.source as JsonRecord | undefined)?.media_type || 'image/png'),
        alt: String(block.alt || '模型返回的图片')
      })),
    ...(Array.isArray(message?.images) ? message.images as AppOutputImage[] : [])
  ];
  result.files = outputFileBlocks(blocks);
  return result;
}
