import { NextRequest } from "next/server";

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

type RatelimitLike = { limit: (id: string) => Promise<{ success: boolean; remaining: number; reset: number }> };

// No-op limiter used when Upstash is not configured (local dev)
const noop: RatelimitLike = {
  limit: async () => ({ success: true, remaining: 999, reset: 0 }),
};

function makeLimiter(requests: number, window: `${number} ${"s" | "m" | "h" | "d"}`): RatelimitLike {
  if (!hasUpstash) return noop;

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
            url: process.env.UPSTASH_REDIS_REST_URL!,
            token: process.env.UPSTASH_REDIS_REST_TOKEN!,
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

/** Extract a stable IP identifier from a Next.js request */
export function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Check a rate limit. Returns true if the request is allowed. */
export async function checkRateLimit(
  limiter: RatelimitLike,
  identifier: string
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const { success, remaining, reset } = await limiter.limit(identifier);
  return { allowed: success, remaining, reset };
}
