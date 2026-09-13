import system from '../../../prompts/system.json';
// Writing prompts are retained on disk but are inactive in ChenTako-web.
const catalog = { system };
export function promptText(name, required = false) {
  const value = catalog[name];
  if (typeof value !== 'string') throw new Error(`prompts/${name}.json 必须是 JSON 字符串。`);
  if (required && !value.trim()) throw new Error(`请先填写 prompts/${name}.json 提示词，再重试。`);
  return value;
}
