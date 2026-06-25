import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicApi = createRouteMatcher([
  "/api/public/(.*)",
  "/api/webhooks/(.*)",
  "/api/cron/(.*)",
]);

const isProtectedApi = createRouteMatcher(["/api/(.*)"]);
const isComposeRoute = createRouteMatcher(["/campaigns/:slug/compose/:path*"]);

export default clerkMiddleware(async (auth, req) => {
  // Public APIs and webhooks: no auth
  if (isPublicApi(req)) return NextResponse.next();

  if (isProtectedApi(req) || isComposeRoute(req)) {
    const { userId, orgId } = await auth();

    if (!userId) {
      if (isComposeRoute(req)) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("next", req.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Forward Clerk identity to route handlers via headers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-clerk-user-id", userId);
    requestHeaders.set("x-clerk-org-id", orgId ?? "");

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
    "/__clerk/:path*",
  ],
};
