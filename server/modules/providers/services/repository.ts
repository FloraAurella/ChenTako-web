import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ProviderRecord, ProviderHeader } from '../../../contracts/types.ts';
import {
  ProviderError,
  normalizeRegistryProvider,
  validateProviderModelConfiguration,
  deriveKeyEnv,
  urlsMatch,
  matchRegistryProvider,
  newProviderId,
  type ProviderInput
} from '../domain/registry-rules.ts';

export interface SqlDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): { all(...values: any[]): unknown[]; get(...values: any[]): unknown; run(...values: any[]): unknown };
  close(): void;
}
interface KeyEnvelope { iv: string; tag: string; data: string }
export class ProviderRepository {
  constructor(private db: SqlDatabase, private master: Buffer, private environmentKey: (name: string) => string = () => '') {
    if (master.length !== 32) throw new Error('凭据保护密钥无效');
    db.exec('CREATE TABLE IF NOT EXISTS providers (id TEXT PRIMARY KEY, position INTEGER NOT NULL, json TEXT NOT NULL)');
    db.exec('CREATE TABLE IF NOT EXISTS keys (key_env TEXT PRIMARY KEY, iv TEXT NOT NULL, tag TEXT NOT NULL, data TEXT NOT NULL)');
  }
  // ---- 注册表 ----

  list(): ProviderRecord[] {
    const rows = this.db.prepare('SELECT json FROM providers ORDER BY position').all() as Array<{ json: string }>;
    return rows
      .map((row) => {
        try { return JSON.parse(row.json) as ProviderRecord; } catch { return null; }
      })
      .filter((provider): provider is ProviderRecord => Boolean(provider));
  }

  private nextPosition(): number {
    const row = this.db.prepare('SELECT MAX(position) AS max FROM providers').get() as { max: number | null };
    return (row.max ?? -1) + 1;
  }

  /**
   * 前端界面保存供应商：id 命中更新并保留原 keyEnv；displayName + baseUrl 命中
   * 复用条目避免重复注册；全新条目分配 id 与去重后的 keyEnv。
   * settingsSchemaVersion === 1 时按前端提交规则重置全局继承字段。
   */
  upsert(providerData: ProviderInput, apiKey?: unknown): { provider: ProviderRecord; keyEnv: string } {
    const displayName = String(providerData?.displayName || '').trim();
    const rawBaseUrl = String(providerData?.baseUrl || '').trim();
    if (!displayName || !rawBaseUrl) {
      throw new ProviderError('供应商同步需要 displayName / baseUrl', 'INVALID_PROVIDER');
    }
    let input = providerData;
    if (providerData.settingsSchemaVersion === 1) {
      input = {
        ...providerData,
        systemPrompt: '', userId: '', temperature: 0.7, topP: 1,
        defaultReasoningEffort: '', streaming: true, saveChats: true, modelCapabilities: {},
        modelOverrides: Object.fromEntries(Object.entries((providerData.modelOverrides || {}) as Record<string, Record<string, unknown>>)
          .map(([model, entry]) => [model, Object.fromEntries(Object.entries(entry).filter(([key]) => ['contextWindow', 'maxTokens'].includes(key)))]))
      };
    }
    validateProviderModelConfiguration(input);
    try {
      const parsedUrl = new URL(rawBaseUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') throw new Error('bad protocol');
    } catch {
      throw new ProviderError('供应商 Base URL 必须是有效的 http/https 地址', 'INVALID_PROVIDER');
    }
    const incoming = normalizeRegistryProvider({
      id: String(input.id || ''),
      displayName,
      enabled: input.enabled,
      baseUrl: rawBaseUrl,
      responseFormat: input.responseFormat,
      defaultReasoningEffort: input.defaultReasoningEffort,
      models: input.models,
      modelCapabilities: input.modelCapabilities,
      modelOverrides: input.modelOverrides,
      defaultModel: input.defaultModel,
      model: input.model,
      maxTokens: input.maxTokens,
      contextWindow: input.contextWindow,
      temperature: input.temperature,
      topP: input.topP,
      streaming: input.streaming,
      saveChats: input.saveChats,
      systemPrompt: input.systemPrompt,
      userId: input.userId
    });
    if (!incoming) throw new ProviderError('供应商配置无效', 'INVALID_PROVIDER');

    const registry = this.list();
    let existingIndex = registry.findIndex((item) => item.id === incoming.id);
    if (existingIndex < 0) {
      existingIndex = registry.findIndex((item) => item.displayName === incoming.displayName && urlsMatch(item.baseUrl, incoming.baseUrl));
    }

    let keyEnv: string;
    let finalProvider: ProviderRecord;
    if (existingIndex >= 0) {
      keyEnv = registry[existingIndex]!.keyEnv;
      finalProvider = { ...incoming, id: registry[existingIndex]!.id, keyEnv };
      this.db.prepare('UPDATE providers SET json = ? WHERE id = ?').run(JSON.stringify(finalProvider), finalProvider.id);
    } else {
      keyEnv = deriveKeyEnv(incoming.displayName);
      const used = new Set(registry.map((item) => item.keyEnv).filter(Boolean));
      let candidate = keyEnv;
      let suffix = 2;
      while (used.has(candidate)) { candidate = `${keyEnv}_${suffix}`; suffix += 1; }
      keyEnv = candidate;
      finalProvider = { ...incoming, id: incoming.id || newProviderId(), keyEnv };
      this.db.prepare('INSERT INTO providers (id, position, json) VALUES (?, ?, ?)').run(finalProvider.id, this.nextPosition(), JSON.stringify(finalProvider));
    }

    if (apiKey && String(apiKey).trim()) this.writeKey(keyEnv, String(apiKey).trim());
    return { provider: finalProvider, keyEnv };
  }

  remove(id: string, fallback?: { displayName?: unknown; baseUrl?: unknown }): { removed: boolean; keyRemoved: boolean } {
    const registry = this.list();
    const idValue = String(id || '');
    let target = registry.find((item) => item.id === idValue);
    if (!target && fallback && typeof fallback === 'object') {
      const baseUrl = String(fallback.baseUrl || '').replace(/\/+$/, '');
      target = registry.find((item) =>
        item.displayName === String(fallback.displayName || '').trim() && urlsMatch(item.baseUrl, baseUrl));
    }
    if (!target) return { removed: false, keyRemoved: false };
    this.db.prepare('DELETE FROM providers WHERE id = ?').run(target.id);
    let keyRemoved = false;
    if (target.keyEnv && this.hasKey(target.keyEnv)) {
      this.removeKeyByEnv(target.keyEnv);
      keyRemoved = true;
    }
    return { removed: true, keyRemoved };
  }

  match(header: ProviderHeader): ProviderRecord | null {
    return matchRegistryProvider(this.list(), header);
  }

  // ---- Key 保险库 ----

  private encrypt(secret: string): KeyEnvelope {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.master, iv);
    const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return {
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
      data: data.toString('hex')
    };
  }

  private decrypt(envelope: KeyEnvelope): string {
    const decipher = createDecipheriv('aes-256-gcm', this.master, Buffer.from(envelope.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.data, 'hex')),
      decipher.final()
    ]).toString('utf8');
  }

  private writeKey(keyEnv: string, secret: string): void {
    const envelope = this.encrypt(secret);
    this.db.prepare(
      'INSERT INTO keys (key_env, iv, tag, data) VALUES (?, ?, ?, ?) ON CONFLICT(key_env) DO UPDATE SET iv = excluded.iv, tag = excluded.tag, data = excluded.data'
    ).run(keyEnv, envelope.iv, envelope.tag, envelope.data);
  }

  private readKey(keyEnv: string): string {
    const row = this.db.prepare('SELECT iv, tag, data FROM keys WHERE key_env = ?').get(keyEnv) as KeyEnvelope | undefined;
    if (!row) return '';
    try { return this.decrypt(row); } catch {
      throw new Error('已保存的 API Key 无法解密（主密钥可能已更换）');
    }
  }

  private removeKeyByEnv(keyEnv: string): void {
    this.db.prepare('DELETE FROM keys WHERE key_env = ?').run(keyEnv);
  }

  hasKey(keyEnv: string): boolean {
    if (!keyEnv || !/^[A-Za-z0-9_]+$/.test(keyEnv)) return false;
    const row = this.db.prepare('SELECT 1 AS one FROM keys WHERE key_env = ?').get(keyEnv);
    if (row) return true;
    return Boolean(this.envKey(keyEnv));
  }

  private envKey(keyEnv: string): string {
    return this.environmentKey(keyEnv);
  }

  /** Key 来源优先级：加密库 > 环境变量。 */
  resolveKey(provider: Pick<ProviderRecord, 'keyEnv'>): string {
    const keyEnv = String(provider.keyEnv || '');
    if (!keyEnv || !/^[A-Za-z0-9_]+$/.test(keyEnv)) return '';
    const stored = this.readKey(keyEnv);
    if (stored) return stored;
    return this.envKey(keyEnv);
  }

  /** 保存 Key（优先按稳定 providerId，兼容按 displayName 反查）。 */
  saveKey(displayNameFallback: string, apiKey: string, providerId: string): string {
    const id = String(providerId || '').trim();
    const target = this.list().find((item) => (id && item.id === id) || item.displayName === String(displayNameFallback || '').trim());
    if (!target || !target.keyEnv) {
      throw Object.assign(new Error(`供应商「${displayNameFallback || '未命名'}」未在后端注册，Key 无法保存。请先保存供应商配置。`), { code: 'PROVIDER_NOT_FOUND' });
    }
    this.writeKey(target.keyEnv, String(apiKey).trim());
    return target.keyEnv;
  }

  removeKey(providerId: string, displayNameFallback: string): boolean {
    const id = String(providerId || '').trim();
    const target = this.list().find((item) => (id && item.id === id) || item.displayName === String(displayNameFallback || '').trim());
    if (!target || !target.keyEnv) return false;
    if (!this.hasKey(target.keyEnv)) return false;
    this.removeKeyByEnv(target.keyEnv);
    return true;
  }

  /** constant-time 比较只在令牌校验使用；此处仅为命名完整保留引用。 */
  static safeEqual(a: Buffer, b: Buffer): boolean {
    return a.length === b.length && timingSafeEqual(a, b);
  }

  close(): void {
    this.db.close();
  }
}
