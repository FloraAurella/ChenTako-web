// DB 名称与 AES-GCM additionalData 都是已发布的加密协议，改动任一项都会让
// 升级前保存的供应商密钥无法解密，因此在 ai-chatbox 中保持字节级兼容。
const VAULT_DB_NAME = "tribblebook-provider-secrets-v1";
const VAULT_STORE_NAME = "vault";
const VAULT_DB_VERSION = 1;
const MASTER_KEY_ID = "master-key";
const ENVELOPE_VERSION = 1;

export interface ProviderKeyEnvelope {
  version: 1;
  algorithm: "AES-GCM";
  iv: string;
  ciphertext: string;
}

type CryptoApi = Pick<Crypto, "getRandomValues" | "subtle">;

function providerRecordId(providerId: string): string {
  return `provider:${providerId}`;
}

function additionalData(providerId: string): Uint8Array {
  return new TextEncoder().encode(`tribblebook:provider-key:${providerId}:v${ENVELOPE_VERSION}`);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function isEnvelope(value: unknown): value is ProviderKeyEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<ProviderKeyEnvelope>;
  return envelope.version === ENVELOPE_VERSION &&
    envelope.algorithm === "AES-GCM" &&
    typeof envelope.iv === "string" &&
    typeof envelope.ciphertext === "string";
}

function isMasterKey(value: unknown): value is CryptoKey {
  if (!value || typeof value !== "object") return false;
  const key = value as CryptoKey;
  return key.type === "secret" &&
    key.extractable === false &&
    key.algorithm?.name === "AES-GCM" &&
    key.usages.includes("encrypt") &&
    key.usages.includes("decrypt");
}

export async function encryptProviderKey(
  providerId: string,
  plaintext: string,
  key: CryptoKey,
  cryptoApi: CryptoApi = globalThis.crypto
): Promise<ProviderKeyEnvelope> {
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const ciphertext = await cryptoApi.subtle.encrypt({
    name: "AES-GCM",
    iv,
    additionalData: additionalData(providerId),
    tagLength: 128
  }, key, new TextEncoder().encode(plaintext));
  return {
    version: ENVELOPE_VERSION,
    algorithm: "AES-GCM",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext))
  };
}

export async function decryptProviderKey(
  providerId: string,
  envelope: ProviderKeyEnvelope,
  key: CryptoKey,
  cryptoApi: CryptoApi = globalThis.crypto
): Promise<string> {
  const plaintext = await cryptoApi.subtle.decrypt({
    name: "AES-GCM",
    iv: base64ToBytes(envelope.iv),
    additionalData: additionalData(providerId),
    tagLength: 128
  }, key, base64ToBytes(envelope.ciphertext));
  return new TextDecoder().decode(plaintext);
}

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("当前环境不支持 IndexedDB Key 保险库"));
      return;
    }
    const request = indexedDB.open(VAULT_DB_NAME, VAULT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VAULT_STORE_NAME)) db.createObjectStore(VAULT_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("API Key 保险库打开失败"));
  });
}

function runTransaction<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, mode);
    const request = operation(tx.objectStore(VAULT_STORE_NAME));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error || new Error("API Key 保险库事务失败"));
    tx.onabort = () => reject(tx.error || new Error("API Key 保险库事务中止"));
  });
}

async function readVaultValue<T>(id: string): Promise<T | undefined> {
  const db = await openVaultDb();
  try {
    return await runTransaction<T | undefined>(db, "readonly", (store) => store.get(id));
  } finally {
    db.close();
  }
}

async function writeVaultValue(id: string, value: unknown): Promise<void> {
  const db = await openVaultDb();
  try {
    await runTransaction(db, "readwrite", (store) => store.put(value, id));
  } finally {
    db.close();
  }
}

async function deleteVaultValue(id: string): Promise<void> {
  const db = await openVaultDb();
  try {
    await runTransaction(db, "readwrite", (store) => store.delete(id));
  } finally {
    db.close();
  }
}

let masterKeyPromise: Promise<CryptoKey> | null = null;

async function masterKey(): Promise<CryptoKey> {
  if (!masterKeyPromise) {
    masterKeyPromise = (async () => {
      const stored = await readVaultValue<unknown>(MASTER_KEY_ID);
      if (isMasterKey(stored)) return stored;
      const generated = await globalThis.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
      await writeVaultValue(MASTER_KEY_ID, generated);
      return generated;
    })().catch((error) => {
      masterKeyPromise = null;
      throw error;
    });
  }
  return masterKeyPromise;
}

export const providerKeyVault = {
  async save(providerId: string, plaintext: string): Promise<void> {
    const id = String(providerId || "").trim();
    const value = String(plaintext || "").trim();
    if (!id || !value) throw new Error("供应商 ID 和 API Key 不能为空");
    const key = await masterKey();
    const envelope = await encryptProviderKey(id, value, key);
    await writeVaultValue(providerRecordId(id), envelope);
  },

  async load(providerId: string): Promise<string> {
    const id = String(providerId || "").trim();
    if (!id) return "";
    const envelope = await readVaultValue<unknown>(providerRecordId(id));
    if (!isEnvelope(envelope)) return "";
    const storedKey = await readVaultValue<unknown>(MASTER_KEY_ID);
    if (!isMasterKey(storedKey)) return "";
    return decryptProviderKey(id, envelope, storedKey);
  },

  async remove(providerId: string): Promise<void> {
    const id = String(providerId || "").trim();
    if (!id) return;
    await deleteVaultValue(providerRecordId(id));
  }
};

export const PROVIDER_KEY_VAULT_DB_NAME = VAULT_DB_NAME;
export const PROVIDER_KEY_VAULT_STORE_NAME = VAULT_STORE_NAME;
