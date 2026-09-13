import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync, lstatSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

export const PROMPT_NAMES = Object.freeze(['system', 'summary', 'title']);
const defaultDirectory = fileURLToPath(new URL('../prompts/', import.meta.url));

/** Convert locally, without model calls, trimming, interpolation or length limits. */
export function convertPrompts(directory = defaultDirectory, { rawNames = [] } = {}) {
  for (const name of rawNames) {
    if (!PROMPT_NAMES.includes(name)) throw new Error(`未知提示词文件：${name}`);
  }
  // Validate all inputs before the first write. A failed read never becomes an empty prompt.
  const pending = PROMPT_NAMES.map(name => {
    const path = join(directory, `${name}.json`);
    if (!lstatSync(path).isFile()) throw new Error(`${name}.json 必须是普通文件，不能是符号链接。`);
    const bytes = readFileSync(path);
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new Error(`${name}.json 不是有效 UTF-8，原文件未修改。`); }
    if (!rawNames.includes(name)) {
      try { if (typeof JSON.parse(text) === 'string') return { name, path, bytes, output: null }; }
      catch { /* Unformatted prompt bodies are the expected input. */ }
    }
    return { name, path, bytes, output: Buffer.from(JSON.stringify(text) + '\n') };
  });
  const results = [];
  for (const entry of pending) {
    const { name, path, bytes, output } = entry;
    if (!output) { results.push({ name, converted: false }); continue; }
    const backupDirectory = join(directory, '.backups');
    mkdirSync(backupDirectory, { recursive: true });
    const digest = createHash('sha256').update(bytes).digest('hex');
    const backup = join(backupDirectory, `${name}-${digest}.txt`);
    try { writeFileSync(backup, bytes, { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      if (error.code !== 'EEXIST' || !readFileSync(backup).equals(bytes)) throw error;
    }
    const temporary = join(directory, `.${name}-${randomUUID()}.tmp`);
    try {
      writeFileSync(temporary, output, { flag: 'wx', mode: 0o600 });
      // Detect an editor save or a second converter before replacing the file.
      const latest = readFileSync(path);
      if (latest.equals(output)) { results.push({ name, converted: false }); continue; }
      if (!latest.equals(bytes)) throw new Error(`${name}.json 在转换期间已变化，请保存后重新运行；未覆盖新内容。`);
      renameSync(temporary, path);
      results.push({ name, converted: true });
    } finally {
      try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args[0] !== '--raw' || args.length !== 2)) throw new Error('用法：npm run prompts:convert [-- --raw 文件名]');
    const rawNames = args.length ? [args[1].replace(/\.json$/, '')] : [];
    const results = convertPrompts(defaultDirectory, { rawNames });
    const changed = results.filter(result => result.converted);
    console.log(changed.length ? `已转换 ${changed.map(result => `${result.name}.json`).join('、')}；原文备份位于 prompts/.backups/。` : '提示词已是有效 JSON 字符串，无需转换。');
  } catch (error) {
    console.error(`提示词转换失败：${error.message}`);
    process.exitCode = 1;
  }
}
