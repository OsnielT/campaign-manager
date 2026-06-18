import { randomBytes, createHash } from "crypto";

/** Generate a cryptographically random 32-byte hex token (64 chars) */
export function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hash a raw token with sha256 for DB storage — raw token is never stored */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
