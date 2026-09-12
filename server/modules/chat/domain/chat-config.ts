import { EFFORT_KEYS } from '../../../contracts/limits.ts';
import type { ChatConfig } from '../../../contracts/types.ts';

/** chatConfig.version 1 解析（原版 lib/chat-config.ts 移植）：与前端 config 默认值对齐。 */
export function parseChatConfig(value: unknown): ChatConfig | null {
  if (value === undefined) return null; // 兼容旧客户端路径
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('chatConfig 必须是对象');
  const input = value as Record<string, unknown>;
  if (input.version !== 1) throw new Error('不支持的聊天配置版本');
  const result: Record<string, unknown> = { version: 1 };
  for (const [key, max] of [['systemPrompt', 102400], ['userId', 200]] as const) {
    if (typeof input[key] !== 'string' || String(input[key]).length > max) throw new Error(`${key} 格式无效或过长`);
    result[key] = input[key];
  }
  for (const [key, min, max] of [['temperature', 0, 2], ['topP', 0, 1], ['inputBudget', 1, 10000000]] as const) {
    if (key === 'inputBudget' && input[key] === null) { result[key] = null; continue; }
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) ||
      input[key] < min || input[key] > max ||
      (key === 'inputBudget' && !Number.isInteger(input[key]))) {
      throw new Error(`${key} 超出有效范围`);
    }
    result[key] = input[key];
  }
  if (!EFFORT_KEYS.includes(input.reasoningEffort as never) || input.reasoningEffort === 'none') {
    throw new Error('思考强度无效');
  }
  if (typeof input.streaming !== 'boolean') throw new Error('流式输出配置无效');
  result.reasoningEffort = input.reasoningEffort;
  result.streaming = input.streaming;
  return result as unknown as ChatConfig;
}
