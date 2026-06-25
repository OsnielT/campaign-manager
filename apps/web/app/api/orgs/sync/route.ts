import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users, organizations, orgMembers, sitePages } from "@/lib/db/schema";
import { getClerkIds } from "@/lib/auth/session";
import { NEUTRAL_LIGHT_BRAND } from "@/lib/campaign-engine/theme";
import { eq } from "drizzle-orm";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

/**
 * POST /api/orgs/sync
 * Called by the onboarding page when the user already has a Clerk org (created
 * during sign-up) but our DB may not have the rows yet (webhooks can lag).
 *
 * This is intentionally resilient: it finds or creates the DB user row first,
 * then the org row, then the membership — covering the case where user.created
 * and organization.created webhooks haven't fired yet.
 *
 * Idempotent — safe to call multiple times.
 */
export async function POST(req: NextRequest) {
  let clerkUserId: string;
  let clerkOrgId: string | null;
  try {
    ({ clerkUserId, clerkOrgId } = getClerkIds(req));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!clerkOrgId) {
    return NextResponse.json({ org: null });
  }

  const clerk = await clerkClient();

  // ── Ensure DB user exists (webhook may not have fired yet) ──────────────────
  let dbUser = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUserId),
    columns: { id: true },
  });

  if (!dbUser) {
    const clerkUser = await clerk.users.getUser(clerkUserId);
    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    );
    const email = primaryEmail?.emailAddress ?? `${clerkUserId}@unknown`;
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      email.split("@")[0];

    // Upsert: email might already exist from an old account
    const byEmail = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true },
    });
    if (byEmail) {
      await db.update(users).set({ clerkId: clerkUserId }).where(eq(users.id, byEmail.id));
      dbUser = byEmail;
    } else {
      const [created] = await db.insert(users).values({ clerkId: clerkUserId, email, name }).returning({ id: users.id });
      dbUser = created;
    }
  }

  const userId = dbUser.id;

  // ── Ensure DB org exists ────────────────────────────────────────────────────
  let dbOrg = await db.query.organizations.findFirst({
    where: eq(organizations.clerkOrgId, clerkOrgId),
  });

  if (!dbOrg) {
    const clerkOrg = await clerk.organizations.getOrganization({ organizationId: clerkOrgId });
    const base = slugify(clerkOrg.slug ?? clerkOrg.name) || "org";
    const taken = await db.query.organizations.findFirst({
      where: eq(organizations.slug, base),
      columns: { id: true },
    });
    const slug = taken ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base;

    const result = await db.transaction(async (tx) => {
      const [newOrg] = await tx
        .insert(organizations)
        .values({ name: clerkOrg.name, slug, clerkOrgId, branding: NEUTRAL_LIGHT_BRAND })
        .returning();
      await tx.insert(sitePages).values({ orgId: newOrg.id, title: "Home", path: "/", type: "home" });
      return newOrg;
    });
    dbOrg = result;
  }

  // ── Ensure membership exists ────────────────────────────────────────────────
  const hasMember = await db.query.orgMembers.findFirst({
    where: (m, { and }) => and(eq(m.orgId, dbOrg!.id), eq(m.userId, userId)),
    columns: { id: true },
  });
  if (!hasMember) {
    await db.insert(orgMembers).values({ orgId: dbOrg.id, userId, role: "owner" });
  }

  return NextResponse.json({ org: dbOrg });
}
