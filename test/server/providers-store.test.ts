// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ProviderStore } from '../../server/modules/providers/services/store.ts';

function newStore(): { store: ProviderStore; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'clawbox-store-'));
  return { store: new ProviderStore(dir), dir };
}
const stores: ProviderStore[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

describe('供应商存储与密钥保险库', () => {
  it('upsert 创建/更新、顺序稳定、keyEnv 去重加后缀', () => {
    const { store } = (() => { const created = newStore(); stores.push(created.store); return created; })();
    const first = store.upsert({ displayName: 'Alpha', baseUrl: 'https://a.com', models: ['m1'] });
    expect(first.provider.id).toBeTruthy();
    expect(first.keyEnv).toBe('alpha');
    const second = store.upsert({ displayName: 'Alpha Two', baseUrl: 'https://b.com', models: ['m1'] });
    expect(second.keyEnv).toBe('alpha_two'); // 名称不同不冲突，无需后缀
    // displayName+baseUrl 命中复用条目，保留原 id 与 keyEnv
    const again = store.upsert({ id: '', displayName: 'Alpha', baseUrl: 'https://a.com/v1', models: ['m1', 'm2'] });
    expect(again.provider.id).toBe(first.provider.id);
    expect(again.keyEnv).toBe('alpha');
    expect(store.list().map((provider) => provider.displayName)).toEqual(['Alpha', 'Alpha Two']);
    // id 命中：keyEnv 不因改名丢失
    const renamed = store.upsert({ id: first.provider.id, displayName: 'Alpha 改', baseUrl: 'https://a.com', models: ['m1'] });
    expect(renamed.keyEnv).toBe('alpha');
  });

  it('API Key 加密落盘并可解密回读；环境变量为兜底来源', () => {
    const { store } = (() => { const created = newStore(); stores.push(created.store); return created; })();
    store.upsert({ displayName: 'Beta', baseUrl: 'https://b.com', models: ['m1'] }, 'sk-secret-1');
    const provider = store.match({ displayName: 'Beta', baseUrl: 'https://b.com' })!;
    expect(store.resolveKey(provider)).toBe('sk-secret-1');
    expect(store.hasKey(provider.keyEnv)).toBe(true);
    // 覆盖保存
    store.upsert({ id: provider.id, displayName: 'Beta', baseUrl: 'https://b.com', models: ['m1'] }, 'sk-secret-2');
    expect(store.resolveKey(provider)).toBe('sk-secret-2');
    // 环境变量兜底：无入库 Key 时读取 CLAWBOX_API_KEY_<keyEnv>
    const { store: envStore } = (() => { const created = newStore(); stores.push(created.store); return created; })();
    envStore.upsert({ displayName: 'Gamma', baseUrl: 'https://g.com', models: ['m1'] });
    const gamma = envStore.match({ displayName: 'Gamma', baseUrl: 'https://g.com' })!;
    const envName = `CLAWBOX_API_KEY_${gamma.keyEnv}`; // 与原版一致：keyEnv 原样进变量名
    process.env[envName] = 'sk-from-env';
    try {
      expect(envStore.resolveKey(gamma)).toBe('sk-from-env');
      expect(envStore.hasKey(gamma.keyEnv)).toBe(true);
    } finally { delete process.env[envName]; }
    // 删除供应商顺带清除 Key
    const removal = envStore.remove(gamma.id);
    expect(removal).toEqual({ removed: true, keyRemoved: false }); // 只有 env Key，库内无
    const betaRemoval = store.remove(provider.id);
    expect(betaRemoval.keyRemoved).toBe(true);
    expect(store.resolveKey({ keyEnv: provider.keyEnv })).toBe('');
  });

  it('主密钥持久化到数据目录（0600），更换主密钥后旧密文拒绝解密', () => {
    const first = newStore(); stores.push(first.store);
    first.store.upsert({ displayName: 'Delta', baseUrl: 'https://d.com', models: ['m1'] }, 'sk-key');
    const keyPath = join(first.dir, '.master-key');
    expect(existsSync(keyPath)).toBe(true);
    expect((readFileSync(keyPath).length)).toBe(32);
    // 同一目录重开：主密钥复用，Key 可读
    const reopened = new ProviderStore(first.dir); stores.push(reopened);
    const provider = reopened.match({ displayName: 'Delta', baseUrl: 'https://d.com' })!;
    expect(reopened.resolveKey(provider)).toBe('sk-key');
    // 更换主密钥（经环境变量注入后重开）：解密失败有明确错误
    const previousMaster = process.env.CLAWBOX_MASTER_KEY;
    process.env.CLAWBOX_MASTER_KEY = randomBytes(32).toString('hex');
    try {
      const rotated = new ProviderStore(first.dir);
      stores.push(rotated);
      expect(() => rotated.resolveKey(provider)).toThrow('无法解密');
    } finally {
      if (previousMaster === undefined) delete process.env.CLAWBOX_MASTER_KEY;
      else process.env.CLAWBOX_MASTER_KEY = previousMaster;
    }
  });

  it('非法输入：缺 displayName/baseUrl、非法 URL、覆盖引用缺失模型', () => {
    const { store } = (() => { const created = newStore(); stores.push(created.store); return created; })();
    expect(() => store.upsert({ displayName: '', baseUrl: 'https://x.com' })).toThrow('displayName');
    expect(() => store.upsert({ displayName: 'X', baseUrl: 'ftp://x.com' })).toThrow('http/https');
    expect(() => store.upsert({ displayName: 'X', baseUrl: 'https://x.com', models: ['m1'], modelOverrides: { ghost: {} } })).toThrow('不存在的模型');
  });
});
