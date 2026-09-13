import { readFileSync } from 'node:fs';
export function taskPrompt(name: 'summary' | 'title'): string {
  let value: unknown;
  try { value = JSON.parse(readFileSync(new URL(`../../../../prompts/${name}.json`, import.meta.url), 'utf8')); }
  catch { throw new Error(`无法读取 prompts/${name}.json，请检查文件及 JSON 格式。`); }
  if (typeof value !== 'string') throw new Error(`prompts/${name}.json 必须是 JSON 字符串。`);
  if (!value.trim()) throw new Error(`请先填写 prompts/${name}.json 提示词，再重试。`);
  return value;
}
