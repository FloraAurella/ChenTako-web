export type ParsedInput =
  | { kind: 'message'; text: string }
  | { kind: 'command'; name: string; argument: string; hasSeparator: boolean };

export function parseCommandInput(raw: string): ParsedInput {
  const text = raw.trim();
  if (!text.startsWith('/') || /[\r\n\u2028\u2029]/.test(text)) return { kind: 'message', text };
  if (text.startsWith('//')) return { kind: 'message', text: text.slice(1) };
  const match = /^\/(\S*)(?:\s+(.*))?$/u.exec(text)!;
  return { kind: 'command', name: match[1].toLowerCase(), argument: match[2] || '', hasSeparator: /\s/.test(raw.trimStart()) };
}
