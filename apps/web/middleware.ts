import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { generateCsrfToken, setCsrfCookie, validateCsrfToken } from "@/lib/auth/csrf";

const ADMIN_PATTERN = /^\/(admin)(\/|$)/;
const PROTECTED_API_PATTERN = /^\/api\//;
const COMPOSE_PATTERN = /^\/campaigns\/[^/]+\/compose\//;
const PUBLIC_API_PREFIXES = [
  "/api/auth/",
  "/api/public/",
  "/api/webhooks/",
  "/api/cron/",
];
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const CSRF_COOKIE = "primitive_csrf";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Determine if this route requires auth
  const isAdminRoute = ADMIN_PATTERN.test(pathname);
  const isProtectedApi =
    PROTECTED_API_PATTERN.test(pathname) &&
    !PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
  const isComposeRoute = COMPOSE_PATTERN.test(pathname);

  if (!isAdminRoute && !isProtectedApi && !isComposeRoute) {
    // Public routes (incl. /api/auth/*) still seed the CSRF cookie when missing,
    // so the first mutating request right after login/signup has a valid token.
    const res = NextResponse.next();
    if (!req.cookies.get(CSRF_COOKIE)?.value) {
      setCsrfCookie(res, generateCsrfToken());
    }
    return res;
  }

  const res = NextResponse.next();

  // Read session
  const session = await getSessionFromRequest(req, res);

  if (!session.userId) {
    if (isAdminRoute) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // CSRF validation for mutating API calls
  if (isProtectedApi && MUTATING_METHODS.has(req.method)) {
    if (!validateCsrfToken(req)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }
  }

  // Forward identity to route handlers via headers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", session.userId);
  requestHeaders.set("x-org-id", session.orgId ?? "");

  const nextRes = NextResponse.next({ request: { headers: requestHeaders } });

  // Re-issue CSRF cookie if missing (session persists across browser restarts but session cookies don't)
  if (!req.cookies.get(CSRF_COOKIE)?.value) {
    setCsrfCookie(nextRes, generateCsrfToken());
  }

  return nextRes;
}

export const config = {
  matcher: [
    "/(admin)/:path*",
    "/api/:path*",
    "/campaigns/:slug/compose/:path*",
  ],
};
