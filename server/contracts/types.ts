import type { ResponseFormat, EffortKey } from './limits.ts';

export type ModelCapabilityFlag = boolean | 'auto';
export type DefaultReasoningEffort = '' | Exclude<EffortKey, 'none'>;

export interface ModelCapability {
  visionInput: ModelCapabilityFlag;
  imageOutput: ModelCapabilityFlag;
}

export interface ModelOverride {
  contextWindow?: number;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  defaultReasoningEffort?: DefaultReasoningEffort;
}

/** 注册表记录（不含 Key）。字段与前端 normalizeProvider/后端 publicRegistry 对齐。 */
export interface ProviderRecord {
  id: string;
  displayName: string;
  enabled: boolean;
  keyEnv: string;
  baseUrl: string;
  responseFormat: ResponseFormat;
  defaultReasoningEffort: DefaultReasoningEffort;
  defaultModel: string;
  models: string[];
  modelCapabilities: Record<string, ModelCapability>;
  modelOverrides: Record<string, ModelOverride>;
  maxTokens: number;
  contextWindow: number;
  temperature: number;
  topP: number;
  streaming: boolean;
  saveChats: boolean;
  systemPrompt: string;
  userId: string;
}

export type PublicProvider = Omit<ProviderRecord, 'keyEnv'> & { hasKeyConfigured: boolean };

/** 前端请求头里的 provider（无 Key）：providerHeader() 的产物。 */
export interface ProviderHeader {
  id?: string;
  displayName?: string;
  baseUrl?: string;
  responseFormat?: string;
}

/** chatConfig.version 1；字段与前端 config.js 默认值对应。 */
export interface ChatConfig {
  version: 1;
  systemPrompt: string;
  userId: string;
  temperature: number;
  topP: number;
  inputBudget: number | null;
  reasoningEffort: EffortKey;
  streaming: boolean;
}

export interface MessageFile {
  name?: unknown;
  text?: unknown;
}

export interface MessagePart {
  type?: string;
  source?: unknown;
  name?: unknown;
  mimeType?: unknown;
  size?: unknown;
  alt?: unknown;
}

export interface WireMessage {
  role?: string;
  content?: unknown;
  files?: MessageFile[];
  parts?: MessagePart[];
}

/** 浏览器 extensions 声明：一期只接受空声明，执行能力明确不支持。 */
export interface ExtensionsRequest {
  tools?: unknown;
  skills?: unknown;
  sandbox?: unknown;
  codeInterpreter?: unknown;
}
