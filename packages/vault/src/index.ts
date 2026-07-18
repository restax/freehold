import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope encryption for vault credentials (AES-256-GCM throughout):
 *
 *   secret --(random per-credential data key)--> ciphertext
 *   data key --(master key)--> wrappedKey
 *
 * The master key comes from VAULT_MASTER_KEY (base64, 32 bytes) — KMS-managed
 * on Freehold Cloud, an env var on self-host. Wrapping per-credential keys
 * means a future master-key rotation only re-wraps small keys, never
 * re-encrypts every secret. All outputs are base64 strings, ready for
 * the VaultCredential columns.
 */

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  tag: string;
  wrappedKey: string;
  wrapIv: string;
  wrapTag: string;
  keyVersion: number;
}

export function loadMasterKey(env: string | undefined = process.env.VAULT_MASTER_KEY): Buffer {
  if (!env) {
    throw new Error("VAULT_MASTER_KEY is not set. Generate one with: openssl rand -base64 32");
  }
  const key = Buffer.from(env, "base64");
  if (key.length !== 32) {
    throw new Error("VAULT_MASTER_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).");
  }
  return key;
}

function gcmEncrypt(key: Buffer, plaintext: Buffer): { out: Buffer; iv: Buffer; tag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const out = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { out, iv, tag: cipher.getAuthTag() };
}

function gcmDecrypt(key: Buffer, data: Buffer, iv: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function encryptSecret(secret: string, masterKey: Buffer): EncryptedSecret {
  const dataKey = randomBytes(32);
  const enc = gcmEncrypt(dataKey, Buffer.from(secret, "utf8"));
  const wrap = gcmEncrypt(masterKey, dataKey);
  return {
    ciphertext: enc.out.toString("base64"),
    iv: enc.iv.toString("base64"),
    tag: enc.tag.toString("base64"),
    wrappedKey: wrap.out.toString("base64"),
    wrapIv: wrap.iv.toString("base64"),
    wrapTag: wrap.tag.toString("base64"),
    keyVersion: 1,
  };
}

export function decryptSecret(enc: EncryptedSecret, masterKey: Buffer): string {
  const dataKey = gcmDecrypt(
    masterKey,
    Buffer.from(enc.wrappedKey, "base64"),
    Buffer.from(enc.wrapIv, "base64"),
    Buffer.from(enc.wrapTag, "base64"),
  );
  const plain = gcmDecrypt(
    dataKey,
    Buffer.from(enc.ciphertext, "base64"),
    Buffer.from(enc.iv, "base64"),
    Buffer.from(enc.tag, "base64"),
  );
  return plain.toString("utf8");
}
