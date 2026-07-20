import { prisma } from "@freehold/db";
import { decryptSecret, type EncryptedSecret, loadMasterKey } from "@freehold/vault";

/**
 * Per-tenant document storage. A workspace can bring its own S3-compatible
 * bucket (S3, R2, Backblaze B2, MinIO, Wasabi); credentials live encrypted on
 * the organization row, same as the vault and the other integrations. When a
 * tenant is connected, new documents route to their bucket; otherwise the
 * platform default (env S3) or Postgres bytes is used. Reads route by each
 * document's recorded provider (see storage.ts), so connecting or changing
 * storage never strands files written under the previous setting.
 */

export interface TenantS3Config {
  provider: "S3";
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

interface StoredS3Config {
  provider: "S3";
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyEnc: EncryptedSecret;
  secretKeyEnc: EncryptedSecret;
}

/** Decrypt a tenant's connected S3 storage, or null if none / undecryptable. */
export async function loadTenantStorage(tenantId: string): Promise<TenantS3Config | null> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { storageConfig: true },
  });
  const stored = org?.storageConfig as StoredS3Config | null;
  if (!stored?.bucket || !stored.accessKeyEnc || !stored.secretKeyEnc) return null;
  try {
    const key = loadMasterKey();
    return {
      provider: "S3",
      endpoint: stored.endpoint,
      region: stored.region || "us-east-1",
      bucket: stored.bucket,
      accessKey: decryptSecret(stored.accessKeyEnc, key),
      secretKey: decryptSecret(stored.secretKeyEnc, key),
    };
  } catch {
    return null;
  }
}

export interface StorageStatus {
  /** tenant = their own bucket; platform = env S3; database = Postgres bytes. */
  source: "tenant" | "platform" | "database";
  bucket?: string;
  endpoint?: string;
}

/** Where this workspace's new documents land, for the Integrations UI. */
export async function storageStatus(tenantId: string): Promise<StorageStatus> {
  const tenant = await loadTenantStorage(tenantId);
  if (tenant) return { source: "tenant", bucket: tenant.bucket, endpoint: tenant.endpoint };
  if (process.env.STORAGE_ENDPOINT && process.env.STORAGE_BUCKET) {
    return {
      source: "platform",
      bucket: process.env.STORAGE_BUCKET,
      endpoint: process.env.STORAGE_ENDPOINT,
    };
  }
  return { source: "database" };
}
