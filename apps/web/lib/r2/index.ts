import { S3Client } from "@aws-sdk/client-s3";

export const r2Enabled =
  !!process.env.R2_ENDPOINT &&
  !!process.env.R2_ACCESS_KEY_ID &&
  !!process.env.R2_SECRET_ACCESS_KEY &&
  !!process.env.R2_BUCKET_NAME;

export const r2 = r2Enabled
  ? new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!, // https://<account-id>.r2.cloudflarestorage.com
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null as unknown as S3Client;

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? "";
export const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL ?? "http://localhost:3000"; // e.g. https://assets.yourdomain.com
