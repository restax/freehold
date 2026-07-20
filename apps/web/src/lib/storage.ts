import { randomUUID } from "node:crypto";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { decryptBytes, encryptBytes, isEncryptedBytes, loadMasterKey } from "@freehold/vault";
import { loadTenantStorage, type TenantS3Config } from "@/lib/storage-config";

/**
 * Storage contract for document bytes. Two drivers behind one interface:
 *
 * - **S3 driver** — active when STORAGE_ENDPOINT + STORAGE_BUCKET are set.
 *   Works with any S3-compatible service (MinIO, SeaweedFS, AWS S3, R2).
 *   The bucket is created on first use if missing.
 * - **DB driver** — the zero-config default: bytes inline in Postgres.
 *
 * A Document row records which driver held its bytes: `storageKey` set (S3)
 * or `data` set (DB). Reads honor whichever is present, so flipping the env
 * never strands previously stored documents.
 */

/** Where a document's bytes live. Null on legacy rows → inferred from data/key. */
export type StorageProvider = "DB" | "S3" | "TENANT_S3";

// `data` matches Prisma's Bytes type (Uint8Array over ArrayBuffer, not Buffer)
// so rows flow through the storage helpers without casts. storageProvider +
// tenantId are needed to route reads/deletes to a tenant's own bucket.
export interface StoredBytes {
  storageKey: string | null;
  data: Uint8Array<ArrayBuffer> | null;
  storageProvider?: string | null;
  tenantId?: string | null;
}

/** putObject result — carries the provider marker to persist on the Document row. */
export interface PutResult {
  storageKey: string | null;
  data: Uint8Array<ArrayBuffer> | null;
  storageProvider: StorageProvider;
}

export function s3Config() {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  if (!endpoint || !bucket) return null;
  return { endpoint, bucket };
}

let s3Singleton: S3Client | null = null;

/** Platform S3 client (env credentials). */
function s3(): S3Client {
  if (!s3Singleton) {
    s3Singleton = new S3Client({
      endpoint: process.env.STORAGE_ENDPOINT,
      region: process.env.STORAGE_REGION || "us-east-1",
      forcePathStyle: true, // required by MinIO and most self-hosted S3 implementations
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "",
        secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "",
      },
    });
  }
  return s3Singleton;
}

/** A fresh S3 client for a tenant's own bucket (no singleton — per-config). */
export function tenantS3Client(cfg: TenantS3Config): S3Client {
  return new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    forcePathStyle: true, // safe for MinIO/R2/B2 and tolerated by AWS
    credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
  });
}

function isNoSuchBucket(err: unknown): boolean {
  const name = (err as { name?: string; Code?: string })?.name ?? (err as { Code?: string })?.Code;
  return name === "NoSuchBucket";
}

/**
 * Documents are envelope-encrypted at the application layer whenever
 * VAULT_MASTER_KEY is set (always on Cloud): even direct database or bucket
 * access yields ciphertext. Reads pass old plaintext objects through
 * unchanged, so enabling encryption never breaks existing documents.
 */
function documentKey(): Buffer | null {
  try {
    return process.env.VAULT_MASTER_KEY ? loadMasterKey() : null;
  } catch {
    return null;
  }
}

export async function putObject(
  tenantId: string,
  filename: string,
  bytes: Buffer,
  contentType: string,
): Promise<PutResult> {
  const key = documentKey();
  const payload = key ? encryptBytes(bytes, key) : bytes;
  const bodyType = key ? "application/octet-stream" : contentType;
  const safeName = filename.replace(/[^\w.-]/g, "_").slice(-80);
  const objectKey = `${tenantId}/${randomUUID()}-${safeName}`;

  // The tenant's own bucket wins when connected; then the platform env bucket;
  // then inline Postgres bytes (the zero-config default).
  const tenant = await loadTenantStorage(tenantId);
  if (tenant) {
    const client = tenantS3Client(tenant);
    await putWithBucketCreate(client, tenant.bucket, objectKey, payload, bodyType);
    return { storageKey: objectKey, data: null, storageProvider: "TENANT_S3" };
  }

  const cfg = s3Config();
  if (!cfg) return { storageKey: null, data: new Uint8Array(payload), storageProvider: "DB" };

  await putWithBucketCreate(s3(), cfg.bucket, objectKey, payload, bodyType);
  return { storageKey: objectKey, data: null, storageProvider: "S3" };
}

/** PUT an object, creating the bucket on first use if it's missing. */
async function putWithBucketCreate(
  client: S3Client,
  bucket: string,
  objectKey: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const cmd = () =>
    client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      }),
    );
  try {
    await cmd();
  } catch (err) {
    if (!isNoSuchBucket(err)) throw err;
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    await cmd();
  }
}

/**
 * Write a raw object to a tenant's connected bucket at a chosen key — no
 * envelope encryption, so client-owned exports are directly openable in the
 * storage they control. Returns false when the workspace has no bucket.
 */
export async function putTenantExport(
  tenantId: string,
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<{ ok: boolean; bucket?: string }> {
  const tenant = await loadTenantStorage(tenantId);
  if (!tenant) return { ok: false };
  await putWithBucketCreate(tenantS3Client(tenant), tenant.bucket, key, bytes, contentType);
  return { ok: true, bucket: tenant.bucket };
}

function maybeDecrypt(buf: Buffer): Buffer {
  if (!isEncryptedBytes(buf)) return buf;
  const key = documentKey();
  if (!key) {
    throw new Error("Document is encrypted but VAULT_MASTER_KEY is not set.");
  }
  return decryptBytes(buf, key);
}

/** Resolve the S3 client + bucket for a stored document, or null for DB/inline. */
async function readTarget(doc: StoredBytes): Promise<{ client: S3Client; bucket: string } | null> {
  // TENANT_S3 needs the tenant's decrypted config; fall back nowhere — a
  // disconnected tenant bucket can't be read, and we say so clearly.
  if (doc.storageProvider === "TENANT_S3") {
    if (!doc.tenantId) throw new Error("Tenant-stored document is missing its tenant id.");
    const tenant = await loadTenantStorage(doc.tenantId);
    if (!tenant) {
      throw new Error(
        "This file lives in the workspace's own storage, which is not connected — reconnect it under Integrations → Storage.",
      );
    }
    return { client: tenantS3Client(tenant), bucket: tenant.bucket };
  }
  const cfg = s3Config();
  if (!cfg) {
    throw new Error(
      "Document is in object storage but STORAGE_ENDPOINT/STORAGE_BUCKET are not configured.",
    );
  }
  return { client: s3(), bucket: cfg.bucket };
}

export async function getObjectBytes(doc: StoredBytes): Promise<Buffer> {
  // Inline DB bytes take precedence when present (covers DB provider + legacy rows).
  if (doc.data) return maybeDecrypt(Buffer.from(doc.data));
  if (doc.storageKey) {
    const { client, bucket } = (await readTarget(doc)) as { client: S3Client; bucket: string };
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: doc.storageKey }));
    if (!res.Body) throw new Error("Object storage returned an empty body.");
    return maybeDecrypt(Buffer.from(await res.Body.transformToByteArray()));
  }
  throw new Error("Document has neither inline data nor a storage key.");
}

/**
 * Prove a tenant's S3 config actually works before we save it: a real
 * put → get → delete round-trip against their bucket (creating it if missing).
 * Never throws — returns a reason the connect UI can show.
 */
export async function verifyTenantStorage(
  cfg: TenantS3Config,
): Promise<{ ok: boolean; error?: string }> {
  const client = tenantS3Client(cfg);
  const testKey = `__freehold_healthcheck/${randomUUID()}.txt`;
  const body = Buffer.from("freehold storage healthcheck");
  try {
    await putWithBucketCreate(client, cfg.bucket, testKey, body, "text/plain");
    const res = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: testKey }));
    const back = res.Body ? Buffer.from(await res.Body.transformToByteArray()) : Buffer.alloc(0);
    await client
      .send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: testKey }))
      .catch(() => {});
    if (!back.equals(body))
      return { ok: false, error: "Wrote a test file but read back mismatched." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Best-effort object cleanup; row deletion proceeds regardless. */
export async function deleteObject(doc: StoredBytes): Promise<void> {
  if (!doc.storageKey) return;
  try {
    const target = await readTarget(doc);
    if (!target) return;
    await target.client.send(
      new DeleteObjectCommand({ Bucket: target.bucket, Key: doc.storageKey }),
    );
  } catch {
    // Orphaned objects are preferable to failed deletes; a cleanup job can sweep later.
  }
}

/**
 * On-demand generated artifacts (currently: full workspace export ZIPs) that
 * are too large to return directly from a Vercel Function — its response
 * body is hard-capped at 4.5 MB, well below one real tenant's documents.
 * These land in the platform bucket under exports/, never encrypted (same
 * call as putTenantExport: the point is a plain file the requester can open),
 * and the caller hands the browser a short-lived presigned URL instead of
 * streaming bytes through the function. A nightly sweep deletes anything
 * left over a day later — these are one-time downloads, not storage.
 */
const EXPORT_PREFIX = "exports/";
const EXPORT_URL_TTL_SECONDS = 15 * 60;
const EXPORT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Whether the platform has its own S3-compatible bucket configured at all. */
export function platformStorageConfigured(): boolean {
  return s3Config() !== null;
}

/**
 * Upload a generated artifact to the platform bucket and return a presigned
 * GET URL that forces the given filename on download. Returns null when no
 * platform bucket is configured — callers fall back to a direct response in
 * that case (fine off Vercel, where the 4.5 MB cap doesn't exist).
 */
export async function presignPlatformExport(
  tenantId: string,
  bytes: Uint8Array,
  filename: string,
  contentType: string,
): Promise<string | null> {
  const cfg = s3Config();
  if (!cfg) return null;

  const key = `${EXPORT_PREFIX}${tenantId}/${Date.now()}-${randomUUID()}.zip`;
  await putWithBucketCreate(s3(), cfg.bucket, key, Buffer.from(bytes), contentType);

  const command = new GetObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
    ResponseContentType: contentType,
  });
  return getSignedUrl(s3(), command, { expiresIn: EXPORT_URL_TTL_SECONDS });
}

/** Delete platform-bucket export artifacts older than a day. Nightly-cron only. */
export async function sweepExpiredExports(): Promise<{ checked: number; deleted: number }> {
  const cfg = s3Config();
  if (!cfg) return { checked: 0, deleted: 0 };

  const client = s3();
  let checked = 0;
  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: EXPORT_PREFIX,
        ContinuationToken: continuationToken,
      }),
    );
    const stale = (page.Contents ?? []).filter(
      (obj) =>
        obj.Key && obj.LastModified && Date.now() - obj.LastModified.getTime() > EXPORT_MAX_AGE_MS,
    );
    checked += page.Contents?.length ?? 0;
    if (stale.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: cfg.bucket,
          Delete: { Objects: stale.map((obj) => ({ Key: obj.Key as string })) },
        }),
      );
      deleted += stale.length;
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return { checked, deleted };
}
