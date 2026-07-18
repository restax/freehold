import { randomUUID } from "node:crypto";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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

// `data` matches Prisma's Bytes type (Uint8Array over ArrayBuffer, not Buffer)
// so rows flow through the storage helpers without casts.
export interface StoredBytes {
  storageKey: string | null;
  data: Uint8Array<ArrayBuffer> | null;
}

function s3Config() {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  if (!endpoint || !bucket) return null;
  return { endpoint, bucket };
}

let s3Singleton: S3Client | null = null;

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

function isNoSuchBucket(err: unknown): boolean {
  const name = (err as { name?: string; Code?: string })?.name ?? (err as { Code?: string })?.Code;
  return name === "NoSuchBucket";
}

export async function putObject(
  tenantId: string,
  filename: string,
  bytes: Buffer,
  contentType: string,
): Promise<StoredBytes> {
  const cfg = s3Config();
  if (!cfg) return { storageKey: null, data: new Uint8Array(bytes) };

  const safeName = filename.replace(/[^\w.-]/g, "_").slice(-80);
  const key = `${tenantId}/${randomUUID()}-${safeName}`;
  const cmd = () =>
    s3().send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );
  try {
    await cmd();
  } catch (err) {
    if (!isNoSuchBucket(err)) throw err;
    await s3().send(new CreateBucketCommand({ Bucket: cfg.bucket }));
    await cmd();
  }
  return { storageKey: key, data: null };
}

export async function getObjectBytes(doc: StoredBytes): Promise<Buffer> {
  if (doc.data) return Buffer.from(doc.data);
  if (doc.storageKey) {
    const cfg = s3Config();
    if (!cfg) {
      throw new Error(
        "Document is in object storage but STORAGE_ENDPOINT/STORAGE_BUCKET are not configured.",
      );
    }
    const res = await s3().send(new GetObjectCommand({ Bucket: cfg.bucket, Key: doc.storageKey }));
    if (!res.Body) throw new Error("Object storage returned an empty body.");
    return Buffer.from(await res.Body.transformToByteArray());
  }
  throw new Error("Document has neither inline data nor a storage key.");
}

/** Best-effort object cleanup; row deletion proceeds regardless. */
export async function deleteObject(doc: StoredBytes): Promise<void> {
  if (!doc.storageKey) return;
  const cfg = s3Config();
  if (!cfg) return;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: doc.storageKey }));
  } catch {
    // Orphaned objects are preferable to failed deletes; a cleanup job can sweep later.
  }
}
