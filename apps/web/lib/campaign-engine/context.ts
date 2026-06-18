/**
 * Visitor context capture — device / geo / traffic source.
 *
 * Pulled from Cloudflare geo headers, the User-Agent, and UTM/referrer params
 * once at session creation, then frozen on the session so routing is stable
 * across the visit. Exposed to routing/actions via `SessionContext.context`
 * (the `context` condition source).
 */
import type { NextRequest } from "next/server";

export interface VisitorContext {
  // Geo (Cloudflare headers; null when not behind Cloudflare)
  country: string | null;
  region: string | null;
  city: string | null;
  // Device (parsed from User-Agent)
  device: "mobile" | "tablet" | "desktop";
  os: string | null;
  browser: string | null;
  // Traffic source
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

/** The keys a `context`-source condition can reference. */
export const CONTEXT_KEYS: (keyof VisitorContext)[] = [
  "country",
  "region",
  "city",
  "device",
  "os",
  "browser",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
];

function parseDevice(ua: string): "mobile" | "tablet" | "desktop" {
  const s = ua.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(s)) return "mobile";
  return "desktop";
}

function parseOs(ua: string): string | null {
  const s = ua.toLowerCase();
  if (/windows/.test(s)) return "Windows";
  if (/iphone|ipad|ipod|ios/.test(s)) return "iOS";
  if (/mac os x|macintosh/.test(s)) return "macOS";
  if (/android/.test(s)) return "Android";
  if (/linux/.test(s)) return "Linux";
  return null;
}

function parseBrowser(ua: string): string | null {
  const s = ua.toLowerCase();
  // Order matters: Edge/Chrome ship "safari"/"chrome" tokens too.
  if (/edg\//.test(s)) return "Edge";
  if (/opr\/|opera/.test(s)) return "Opera";
  if (/firefox/.test(s)) return "Firefox";
  if (/chrome|crios/.test(s)) return "Chrome";
  if (/safari/.test(s)) return "Safari";
  return null;
}

/** Build the visitor context from the request + captured URL params. */
export function buildVisitorContext(
  req: NextRequest,
  urlParams: Record<string, string>
): VisitorContext {
  const h = req.headers;
  const ua = h.get("user-agent") ?? "";
  const lc = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

  return {
    country: lc(h.get("cf-ipcountry")),
    region: lc(h.get("cf-region")),
    city: lc(h.get("cf-ipcity")),
    device: parseDevice(ua),
    os: parseOs(ua),
    browser: parseBrowser(ua),
    referrer: lc(h.get("referer")) ?? lc(urlParams.referrer),
    utm_source: lc(urlParams.utm_source),
    utm_medium: lc(urlParams.utm_medium),
    utm_campaign: lc(urlParams.utm_campaign),
  };
}
