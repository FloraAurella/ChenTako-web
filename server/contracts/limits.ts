/**
 * 线上限额契约：必须与 src/contracts/constants.js 的 LIMITS 保持一致。
 * test/server/contracts-sync.test.ts 直接导入前端常量做相等断言，两侧不同步会红测。
 */
export const LIMITS = {
  attachmentBytes: 5 * 1024 * 1024,
  attachmentsTotalBytes: 15 * 1024 * 1024,
  imageBytes: 20 * 1024 * 1024,
  imagesPerMessage: 4,
  imagesTotalBytes: 80 * 1024 * 1024,
  fileBytes: 20 * 1024 * 1024,
  filesPerMessage: 8,
  filesTotalBytes: 80 * 1024 * 1024,
  messageChars: 100 * 1024,
  draftChars: 100 * 1024,
  summaryChars: 2 * 1024 * 1024,
  importBytes: 130 * 1024 * 1024,
  backgroundImageBytes: 20 * 1024 * 1024,
  themeFileBytes: 256 * 1024,
  themePackageBytes: 5 * 1024 * 1024,
  persistDebounceMs: 320,
  estimateCharsPerToken: 3.6,
  defaultContextWindow: 131072,
  titleLength: 18
};

/** 顺序与前端 RESPONSE_FORMATS 一致（responses 在前），防漂移测试做全等断言。 */
export const RESPONSE_FORMATS = ['responses', 'anthropic', 'openai-compatible', 'google'] as const;
export type ResponseFormat = (typeof RESPONSE_FORMATS)[number];

/** 前端 EFFORT_LEVELS 的状态值；历史 none 档表示不携带推理参数。 */
export const EFFORT_KEYS = ['none', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortKey = (typeof EFFORT_KEYS)[number];

export const DEFAULT_MAX_TOKENS = 8192;
export const DEFAULT_CONTEXT_WINDOW = LIMITS.defaultContextWindow;

export const STREAM_TIMEOUT_MS = 5 * 60 * 1000;
export const CONNECTION_TEST_TIMEOUT_MS = 15 * 1000;
