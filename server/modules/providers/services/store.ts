import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ProviderRepository } from './repository.ts';
export class ProviderStore extends ProviderRepository {
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(join(dataDir, 'providers.sqlite'));
    db.exec('PRAGMA journal_mode=WAL');
    super(db, loadMasterKey(dataDir), name => String(process.env[`AI_CHATBOX_API_KEY_${name}`] ?? process.env[`CLAWBOX_API_KEY_${name}`] ?? process.env[`TRIBBLEBOOK_API_KEY_${name}`] ?? '').trim());
  }
}
function loadMasterKey(dataDir: string): Buffer {
    const masterKeyEnv = process.env.AI_CHATBOX_MASTER_KEY ?? process.env.CLAWBOX_MASTER_KEY ?? process.env.TRIBBLEBOOK_MASTER_KEY;
    if (masterKeyEnv) {
      const master = Buffer.from(String(masterKeyEnv), 'hex');
      if (master.length !== 32) throw new Error('AI_CHATBOX_MASTER_KEY 必须是 64 位 hex（32 字节）');
      return master;
    }
    const keyPath = join(dataDir, '.master-key');
    if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });
    chmodSync(keyPath, 0o600);
    const master = readFileSync(keyPath);
    if (master.length !== 32) throw new Error('本地凭据保护密钥无效');
    return master;
  }
