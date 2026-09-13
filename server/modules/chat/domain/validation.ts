import { LIMITS } from '../../../contracts/limits.ts';
import type { WireMessage } from '../../../contracts/types.ts';

/**
 * /api/chat 请求校验（原版 routes/chat.ts 移植）：限额与 src/contracts LIMITS
 * 同源，附件/图片/文件逐类计数，损坏数据不会静默截断而是整请求拒绝。
 */
export function validateMessages(messages: WireMessage[]): string {
  let attachmentBytes = 0;
  let imageBytes = 0;
  let fileBytes = 0;
  for (const message of messages) {
    if (!message || (message.role !== 'user' && message.role !== 'assistant')) {
      return 'messages 只允许 user / assistant 角色';
    }
    if (typeof message.content !== 'string') return 'message.content 必须是字符串';
    if (message.files !== undefined && !Array.isArray(message.files)) return 'message.files 必须是数组';
    if (message.parts !== undefined && !Array.isArray(message.parts)) return 'message.parts 必须是数组';
    for (const file of message.files || []) {
      if (!file || typeof file.text !== 'string') return '附件内容必须是文本';
      const size = Buffer.byteLength(file.text, 'utf8');
      if (size > LIMITS.attachmentBytes) {
        return `单个附件不能超过 ${LIMITS.attachmentBytes / 1024 / 1024}MB`;
      }
      attachmentBytes += size;
      if (attachmentBytes > LIMITS.attachmentsTotalBytes) {
        return `本次请求的附件总量不能超过 ${LIMITS.attachmentsTotalBytes / 1024 / 1024}MB`;
      }
    }
    const parts = message.parts || [];
    const imageParts = parts.filter((part) => part?.type === 'image');
    if (imageParts.length > LIMITS.imagesPerMessage) {
      return `单条消息最多包含 ${LIMITS.imagesPerMessage} 张图片`;
    }
    for (const part of imageParts) {
      const source = String(part?.source || '');
      const dataMatch = source.match(/^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i);
      const isRemote = /^https:\/\/\S{1,4096}$/i.test(source) ||
        /^http:\/\/(?:127(?:\.\d{1,3}){3}|localhost)(?::\d+)?\/\S{0,4096}$/i.test(source);
      if (!dataMatch && !isRemote) return '图片必须是受支持的 data URL 或 HTTPS 地址';
      if (dataMatch) {
        const encoded = String(dataMatch[2]).replace(/\s/g, '');
        const size = Math.max(0, Math.floor(encoded.length * 0.75) - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0));
        if (size > LIMITS.imageBytes) return '单张图片不能超过 20MB';
        imageBytes += size;
        if (imageBytes > LIMITS.imagesTotalBytes) return '本次请求的图片总量不能超过 80MB';
      }
    }
    const fileParts = parts.filter((part) => part?.type === 'file');
    if (fileParts.length > LIMITS.filesPerMessage) {
      return `单条消息最多包含 ${LIMITS.filesPerMessage} 个文件附件`;
    }
    for (const part of fileParts) {
      const name = String(part?.name || '文件').slice(0, 200);
      const source = String(part?.source || '');
      const dataMatch = source.match(/^data:([a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*);base64,([A-Za-z0-9+/=\s]+)$/i);
      const isRemote = /^https:\/\/\S{1,4096}$/i.test(source) ||
        /^http:\/\/(?:127(?:\.\d{1,3}){3}|localhost)(?::\d+)?\/\S{0,4096}$/i.test(source);
      if (!dataMatch && !isRemote) return `附件「${name}」必须是受支持的 data URL 或 HTTPS 地址`;
      if (dataMatch) {
        const encoded = String(dataMatch[2]).replace(/\s/g, '');
        const size = Math.max(0, Math.floor(encoded.length * 0.75) - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0));
        if (size > LIMITS.fileBytes) return `单个文件附件不能超过 20MB：「${name}」`;
        fileBytes += size;
        if (fileBytes > LIMITS.filesTotalBytes) return '本次请求的文件附件总量不能超过 80MB';
      }
    }
  }
  return '';
}

export function validateContextSummary(value: unknown): { ok: boolean; error?: string; value?: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: '' };
  if (typeof value !== 'string') return { ok: false, error: 'contextSummary 必须是字符串' };
  if (Buffer.byteLength(value, 'utf8') > LIMITS.summaryChars) return { ok: false, error: '压缩上下文不能超过 2MB' };
  return { ok: true, value: value.trim() };
}

/**
 * 一期后端只接受空扩展声明：工具/技能/沙箱/代码解释器执行属于暂缓的
 * Agent 执行系统。声明内容存在时明确拒绝，不静默忽略。
 */
export function hasExecutableExtensions(extensions: unknown): boolean {
  if (!extensions || typeof extensions !== 'object' || Array.isArray(extensions)) return false;
  const request = extensions as Record<string, unknown>;
  const tools = Array.isArray(request.tools) ? request.tools.length > 0 : Boolean(request.tools);
  const skills = Array.isArray(request.skills) ? request.skills.length > 0 : Boolean(request.skills);
  return tools || skills || request.sandbox === true || request.codeInterpreter === true;
}

export const EXTENSIONS_UNSUPPORTED_ERROR =
  '当前后端未启用工具、技能、运行时沙箱或代码解释器执行；请在聊天设置中关闭相关扩展后重试。';
