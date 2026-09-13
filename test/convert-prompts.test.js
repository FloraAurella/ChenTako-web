// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { convertPrompts, PROMPT_NAMES } from '../scripts/convert-prompts.mjs';

const directories = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'chentako-prompt-converter-'));
  directories.push(directory);
  for (const name of PROMPT_NAMES) writeFileSync(join(directory, `${name}.json`), '""\n');
  return directory;
}
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe('local prompt conversion', () => {
  it('preserves long text, Chinese, quotes, escapes, code and whitespace exactly', () => {
    const dir = fixture();
    const body = '  第一行\r\n"引号"\\路径\\n\n```json\n{"conflicts":[]}\n```\n' + '长提示词🌧️'.repeat(300000) + '\n  ';
    writeFileSync(join(dir, 'summary.json'), body);
    const result = convertPrompts(dir);
    expect(JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'))).toBe(body);
    expect(result.filter(r => r.converted).map(r => r.name)).toEqual(['summary']);
    const backups = readdirSync(join(dir, '.backups'));
    expect(backups).toHaveLength(1);
    expect(readFileSync(join(dir, '.backups', backups[0]), 'utf8')).toBe(body);
  });
  it('does not encode already converted JSON a second time or rewrite it', () => {
    const dir = fixture();
    writeFileSync(join(dir, 'title.json'), '请修改\n第二行');
    convertPrompts(dir);
    const before = readFileSync(join(dir, 'title.json'));
    expect(convertPrompts(dir).every(r => !r.converted)).toBe(true);
    expect(readFileSync(join(dir, 'title.json'))).toEqual(before);
    expect(readdirSync(join(dir, '.backups'))).toHaveLength(1);
  });
  it.each(['{"role":"这里是提示词正文，不是配置对象"}', '[1,2]', 'null', ''])('treats non-string JSON or empty input as verbatim text: %s', body => {
    const dir = fixture();
    writeFileSync(join(dir, 'system.json'), body);
    convertPrompts(dir);
    expect(JSON.parse(readFileSync(join(dir, 'system.json'), 'utf8'))).toBe(body);
  });
  it('supports a literal quoted body through explicit raw conversion', () => {
    const dir = fixture();
    writeFileSync(join(dir, 'system.json'), '"保留外层引号"');
    convertPrompts(dir, { rawNames: ['system'] });
    expect(JSON.parse(readFileSync(join(dir, 'system.json'), 'utf8'))).toBe('"保留外层引号"');
    expect(convertPrompts(dir).every(r => !r.converted)).toBe(true);
  });
  it('invalid UTF-8 aborts before writing any prompt', () => {
    const dir = fixture();
    writeFileSync(join(dir, 'system.json'), '尚未转换');
    writeFileSync(join(dir, 'title.json'), Buffer.from([0xff, 0xfe]));
    expect(() => convertPrompts(dir)).toThrow('UTF-8');
    expect(readFileSync(join(dir, 'system.json'), 'utf8')).toBe('尚未转换');
  });
  it('backup failure leaves the original prompt untouched', () => {
    const dir = fixture();
    writeFileSync(join(dir, 'system.json'), '必须完整保留');
    writeFileSync(join(dir, '.backups'), '占用备份目录名');
    expect(() => convertPrompts(dir)).toThrow();
    expect(readFileSync(join(dir, 'system.json'), 'utf8')).toBe('必须完整保留');
  });
  it('missing files and symlinks are rejected without replacing other inputs', () => {
    const dir = fixture();
    writeFileSync(join(dir, 'system.json'), '原始文本');
    rmSync(join(dir, 'title.json'));
    expect(() => convertPrompts(dir)).toThrow();
    symlinkSync(join(dir, 'system.json'), join(dir, 'title.json'));
    expect(() => convertPrompts(dir)).toThrow('普通文件');
    expect(readFileSync(join(dir, 'system.json'), 'utf8')).toBe('原始文本');
  });
});

it('converts only the three active prompts and never reads inactive writing files', () => {
  const dir = fixture();
  writeFileSync(join(dir, 'write.json'), Buffer.from([0xff]));
  expect(PROMPT_NAMES).toEqual(['system', 'summary', 'title']);
  expect(convertPrompts(dir).map(r => r.name)).toEqual(['system', 'summary', 'title']);
  expect(readFileSync(join(dir, 'write.json'))).toEqual(Buffer.from([0xff]));
});
