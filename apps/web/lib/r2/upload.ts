import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET, R2_PUBLIC_BASE_URL } from "./index";

export const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "application/pdf",
]);

export const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function r2Key(orgId: string, assetId: string, filename: string): string {
  // Sanitize filename: strip path separators, keep extension
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);
  return `orgs/${orgId}/${assetId}/${safe}`;
}

export function publicUrl(key: string): string {
  return `${R2_PUBLIC_BASE_URL}/${key}`;
}

export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  sizeBytes: number
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
  });

  return getSignedUrl(r2, command, { expiresIn: 900 }); // 15 minutes
}
