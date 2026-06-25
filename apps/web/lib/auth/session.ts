import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users, organizations, orgMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { NextRequest } from "next/server";

// Short-lived in-process cache so repeated calls within a hot loop don't hammer the DB.
const _idCache = new Map<string, { userId: string; orgId: string | null; expiresAt: number }>();
const CACHE_TTL = 30_000;

async function lookupInternalIds(clerkUserId: string, clerkOrgId: string | null) {
  const key = `${clerkUserId}:${clerkOrgId ?? ""}`;
  const hit = _idCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return { userId: hit.userId, orgId: hit.orgId };

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUserId),
    columns: { id: true },
  });
  if (!user) return null;

  let orgId: string | null = null;
  if (clerkOrgId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, clerkOrgId),
      columns: { id: true },
    });
    orgId = org?.id ?? null;
  }

  // Clerk's JWT active-org claim may lag behind setActive() on first redirect.
  // Fall back to the user's first org membership so the admin layout doesn't
  // redirect back to onboarding while the token is still stale.
  if (!orgId) {
    const membership = await db.query.orgMembers.findFirst({
      where: eq(orgMembers.userId, user.id),
      with: { org: { columns: { id: true } } },
    });
    orgId = membership?.org?.id ?? null;
  }

  const result = { userId: user.id, orgId };
  // Only cache when the org came from Clerk's JWT claim; the DB-fallback result
  // is stale as soon as the JWT refreshes, so caching it would mask the real org.
  if (clerkOrgId) {
    _idCache.set(key, { ...result, expiresAt: Date.now() + CACHE_TTL });
  }
  return result;
}

/** Read identity in server components — cached per request render */
export const getSession = cache(async (): Promise<{ userId: string | null; orgId: string | null }> => {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  if (!clerkUserId) return { userId: null, orgId: null };

  const ids = await lookupInternalIds(clerkUserId, clerkOrgId ?? null);
  return { userId: ids?.userId ?? null, orgId: ids?.orgId ?? null };
});

/** Read Clerk IDs injected by middleware (route handlers only) */
export function getClerkIds(req: NextRequest): { clerkUserId: string; clerkOrgId: string | null } {
  const clerkUserId = req.headers.get("x-clerk-user-id");
  if (!clerkUserId) throw new Error("No x-clerk-user-id header — route not protected by middleware");
  return { clerkUserId, clerkOrgId: req.headers.get("x-clerk-org-id") || null };
}

/** Read internal user/org IDs from middleware-injected Clerk headers (route handlers only) */
export async function getRequestUser(req: NextRequest): Promise<{ userId: string; orgId: string | null }> {
  const { clerkUserId, clerkOrgId } = getClerkIds(req);
  const ids = await lookupInternalIds(clerkUserId, clerkOrgId);
  if (!ids) throw new Error("Clerk user has no corresponding DB record: " + clerkUserId);
  return ids;
}
