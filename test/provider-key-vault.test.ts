import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptProviderKey, encryptProviderKey } from "../src/modules/connections/services/provider-key-vault";

describe("Provider API Key 前端加密信封", () => {
  it("使用不可导出 AES-GCM 密钥往返，信封不包含明文", async () => {
    const cryptoApi = webcrypto as unknown as Crypto;
    const key = await cryptoApi.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    const plaintext = "sk-test-original-secret";
    const envelope = await encryptProviderKey("provider-a", plaintext, key, cryptoApi);

    expect(key.extractable).toBe(false);
    expect(envelope.algorithm).toBe("AES-GCM");
    expect(envelope.iv).toBeTruthy();
    expect(envelope.ciphertext).toBeTruthy();
    expect(JSON.stringify(envelope)).not.toContain(plaintext);
    await expect(decryptProviderKey("provider-a", envelope, key, cryptoApi)).resolves.toBe(plaintext);
  });

  it("把供应商 ID 绑定为附加认证数据，密文不能串用", async () => {
    const cryptoApi = webcrypto as unknown as Crypto;
    const key = await cryptoApi.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    const envelope = await encryptProviderKey("provider-a", "secret", key, cryptoApi);

    await expect(decryptProviderKey("provider-b", envelope, key, cryptoApi)).rejects.toBeTruthy();
  });
});
