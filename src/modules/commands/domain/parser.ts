export type ParsedInput =
  | { kind: 'message'; text: string }
  | { kind: 'command'; name: string; argument: string; hasSeparator: boolean; target?: string };

export function parseCommandInput(raw: string, multilineNames: string[] = []): ParsedInput {
  const text = raw.trim();
  if (text.startsWith('@@')) return { kind: 'message', text: text.slice(1) };
  if (text.startsWith('@')) {
    const match = /^@("(?:\\.|[^"\\])*"|[^\s"]+)(?:\s+([\s\S]*))?$/u.exec(text);
    if (!match) return { kind: 'command', name: '@', argument: text.slice(1), hasSeparator: true };
    let target = match[1];
    if (target.startsWith('"')) { try { target = JSON.parse(target); } catch { return { kind: 'command', name: '@', argument: '', hasSeparator: true }; } }
    if (!match[2]) return { kind: 'command', name: '@', argument: target, hasSeparator: true };
    const command = parseCommandInput(match[2], multilineNames);
    if (command.kind === 'command' && command.name !== '@') return { ...command, target };
    return { kind: 'command', name: '@', argument: '', hasSeparator: true };
  }
  const name = /^\/(\S*)/u.exec(text)?.[1].toLowerCase();
  if (!text.startsWith('/') || (/[\r\n\u2028\u2029]/.test(text) && !multilineNames.includes(name || ''))) return { kind: 'message', text };
  if (text.startsWith('//')) return { kind: 'message', text: text.slice(1) };
  const match = /^\/(\S*)(?:\s+([\s\S]*))?$/u.exec(text)!;
  return { kind: 'command', name: match[1].toLowerCase(), argument: match[2] || '', hasSeparator: /\s/.test(raw.trimStart()) };
}
