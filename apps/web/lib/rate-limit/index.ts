import { NextRequest } from "next/server";

// Vercel's Upstash marketplace integration injects KV_REST_API_URL/KV_REST_API_TOKEN,
// while a direct Upstash setup uses UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.
// Accept either so the same code works in both environments. (Note: the Ratelimit
// SDK needs the REST endpoint + token, NOT the redis:// REDIS_URL connection string.)
const REDIS_REST_URL =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const REDIS_REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

const hasUpstash = !!REDIS_REST_URL && !!REDIS_REST_TOKEN;
const isProd = process.env.NODE_ENV === "production";

type RatelimitLike = { limit: (id: string) => Promise<{ success: boolean; remaining: number; reset: number }> };

// No-op limiter for local dev when Upstash is not configured.
const noop: RatelimitLike = {
  limit: async () => ({ success: true, remaining: 999, reset: 0 }),
};

// In production, Upstash is mandatory: rate limiting guards auth brute-force and
// public lookup enumeration. If it's missing we must NOT silently allow traffic.
// Fail closed at request time (not import time, to avoid breaking `next build`)
// and log loudly so the misconfiguration is obvious.
let warnedMissingUpstash = false;
const failClosed: RatelimitLike = {
  limit: async () => {
    if (!warnedMissingUpstash) {
      console.error(
        "[rate-limit] FATAL: Redis REST credentials are not set in production " +
          "(expected UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN). " +
          "Rate-limited endpoints are denying traffic until configured."
      );
      warnedMissingUpstash = true;
    }
    return { success: false, remaining: 0, reset: 0 };
  },
};

function makeLimiter(requests: number, window: `${number} ${"s" | "m" | "h" | "d"}`): RatelimitLike {
  if (!hasUpstash) return isProd ? failClosed : noop;

  // Lazy dynamic import so build succeeds without Upstash env vars
  let cached: RatelimitLike | null = null;
  return {
    limit: async (id) => {
      if (!cached) {
        const [{ Ratelimit }, { Redis }] = await Promise.all([
          import("@upstash/ratelimit"),
          import("@upstash/redis"),
        ]);
        cached = new Ratelimit({
          redis: new Redis({
            url: REDIS_REST_URL!,
            token: REDIS_REST_TOKEN!,
          }),
          limiter: Ratelimit.slidingWindow(requests, window),
          analytics: false,
        });
      }
      return cached.limit(id);
    },
  };
}

// Per-IP limits
export const rateLimiters = {
  login: () => makeLimiter(10, "15 m"),
  signup: () => makeLimiter(5, "1 h"),
  reset: () => makeLimiter(3, "1 h"),
  mutate: () => makeLimiter(60, "1 m"),
  upload: () => makeLimiter(5, "1 m"),
  lookup: () => makeLimiter(10, "1 m"),
  submit: () => makeLimiter(30, "1 m"),
} as const;

/**
 * Extract a stable client IP for rate-limit keys.
 *
 * On Vercel, `x-vercel-forwarded-for` is set by the platform edge and cannot be
 * spoofed by the client, so we trust it first. `x-forwarded-for` is client-
 * controllable (an attacker can rotate it to dodge per-IP limits), so we only
 * fall back to it in non-Vercel/local environments.
 */
export function getIp(req: NextRequest): string {
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0]!.trim();

  if (!isProd) {
    const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (xff) return xff;
    const xri = req.headers.get("x-real-ip");
    if (xri) return xri;
  }

  return "unknown";
}

/** Check a rate limit. Returns true if the request is allowed. */
export async function checkRateLimit(
  limiter: RatelimitLike,
  identifier: string
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const { success, remaining, reset } = await limiter.limit(identifier);
  return { allowed: success, remaining, reset };
}
