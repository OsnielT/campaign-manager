import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { organizations, orgMembers, sitePages } from "@/lib/db/schema";
import { getRequestUser, getClerkIds } from "@/lib/auth/session";
import { NEUTRAL_LIGHT_BRAND } from "@/lib/campaign-engine/theme";
import { errorResponse, badRequest, unauthorized } from "@/lib/errors";
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
 * GET /api/orgs
 * Returns the user's current org (if any). Used by onboarding to detect
 * whether Clerk already created an org during sign-up so the org step can be skipped.
 */
export async function GET(req: NextRequest) {
  let userId: string;
  try {
    ({ userId } = await getRequestUser(req));
  } catch {
    return NextResponse.json(errorResponse(unauthorized()), { status: 401 });
  }

  const membership = await db.query.orgMembers.findFirst({
    where: eq(orgMembers.userId, userId),
    with: { org: true },
  });

  return NextResponse.json({ org: membership?.org ?? null });
}

/**
 * POST /api/orgs/sync is handled in app/api/orgs/sync/route.ts
 */

export async function POST(req: NextRequest) {
  let userId: string;
  let clerkUserId: string;
  try {
    ({ userId } = await getRequestUser(req));
    ({ clerkUserId } = getClerkIds(req));
  } catch {
    return NextResponse.json(errorResponse(unauthorized()), { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, slug: customSlug } = body ?? {};

    if (!name) {
      return NextResponse.json(errorResponse(badRequest("name is required")), { status: 400 });
    }

    const slug = customSlug ? slugify(customSlug) : slugify(name);

    const existing = await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
      columns: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        errorResponse(badRequest("Slug already taken", "SLUG_TAKEN")),
        { status: 409 }
      );
    }

    // Create Clerk organization
    const clerk = await clerkClient();
    const clerkOrg = await clerk.organizations.createOrganization({
      name,
      createdBy: clerkUserId,
    });

    const org = await db.transaction(async (tx) => {
      const [newOrg] = await tx
        .insert(organizations)
        .values({ name, slug, clerkOrgId: clerkOrg.id, branding: NEUTRAL_LIGHT_BRAND })
        .returning();

      await tx.insert(orgMembers).values({
        orgId: newOrg.id,
        userId,
        role: "owner",
      });

      await tx.insert(sitePages).values({
        orgId: newOrg.id,
        title: "Home",
        path: "/",
        type: "home",
      });

      return newOrg;
    });

    return NextResponse.json({ org, clerkOrgId: clerkOrg.id }, { status: 201 });
  } catch (err) {
    console.error("[create-org]", err);
    return NextResponse.json(errorResponse(err), { status: 500 });
  }
}
