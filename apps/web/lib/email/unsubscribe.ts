// Signed, stateless unsubscribe links. The token is an HMAC of the audience
// record id, so the public endpoint can verify a link without a session and
// without storing per-email tokens.

import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  return process.env.SESSION_SECRET ?? "dev-unsubscribe-secret";
}

/** HMAC token binding an unsubscribe link to a specific audience record. */
export function signUnsubscribe(recordId: string): string {
  return createHmac("sha256", secret()).update(recordId).digest("hex").slice(0, 32);
}

/** Constant-time check that a token matches the record id. */
export function verifyUnsubscribe(recordId: string, token: string): boolean {
  const expected = signUnsubscribe(recordId);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Absolute unsubscribe URL for a recipient's audience record. */
export function unsubscribeUrl(recordId: string): string {
  return `${appUrl()}/api/public/unsubscribe?u=${recordId}&t=${signUnsubscribe(recordId)}`;
}
