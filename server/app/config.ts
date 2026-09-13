import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { ServerConfig } from '../contracts/contributions.ts';

/** AI_CHATBOX_ 优先；CLAWBOX_ 与 TRIBBLEBOOK_ 为旧部署兼容入口。 */
function env(name: string): string | undefined {
  return process.env[`AI_CHATBOX_${name}`] ?? process.env[`CLAWBOX_${name}`] ?? process.env[`TRIBBLEBOOK_${name}`];
}

function csv(name: string): string[] {
  return String(env(name) || '').split(',').map((value) => value.trim()).filter(Boolean);
}

export function loadServerConfig(serverRoot: string): ServerConfig {
  const dataDir = resolve(env('DATA_DIR') || `${serverRoot}/.data`);
  // 密钥数据库落盘前先建目录；权限 0700，仅本机当前用户可读。
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  return {
    host: env('HOST') || '127.0.0.1',
    port: Number(env('PORT')) || 3000,
    apiToken: String(env('API_TOKEN') || ''),
    corsOrigins: csv('CORS_ORIGIN'),
    allowNullOrigin: env('ALLOW_NULL_ORIGIN') === 'true',
    dataDir,
    ssrfAllow: csv('SSRF_ALLOW').map((value) => value.toLowerCase()),
    bodyLimitBytes: Number(env('BODY_LIMIT')) || 130 * 1024 * 1024,
    disabledModules: (process.env.AI_CHATBOX_DISABLED_MODULES ?? process.env.CLAWBOX_DISABLED_MODULES ?? process.env.DISABLED_MODULES ?? '')
      .split(',').map((value) => value.trim()).filter(Boolean)
  };
}
