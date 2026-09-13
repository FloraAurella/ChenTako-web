import { describe, expect, it } from 'vitest';
import { browserApiCredential } from '../src/shared/api.js';
describe('browser cloud identity', () => {
  it('retains identity and isolates another browser store', () => {
    const storage = () => { const data = new Map(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) }; };
    const a = storage(); const b = storage();
    expect(browserApiCredential(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(browserApiCredential(a)).toBe(browserApiCredential(a));
    expect(browserApiCredential(a)).not.toBe(browserApiCredential(b));
  });
  it('blocks requests when identity cannot be saved or has been corrupted', () => {
    expect(() => browserApiCredential({ getItem: () => null, setItem() {} })).toThrow('无法保存');
    expect(() => browserApiCredential({ getItem: () => 'broken', setItem() {} })).toThrow('损坏');
  });
});
