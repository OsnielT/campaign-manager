import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, orgMembers, sitePages } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json(errorResponse(unauthorized()), { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, slug: customSlug } = body ?? {};

    if (!name) {
      return NextResponse.json(errorResponse(badRequest("name is required")), {
        status: 400,
      });
    }

    const slug = customSlug ? slugify(customSlug) : slugify(name);

    // Check slug uniqueness
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

    const org = await db.transaction(async (tx) => {
      const [newOrg] = await tx
        .insert(organizations)
        .values({ name, slug, branding: NEUTRAL_LIGHT_BRAND })
        .returning();

      await tx.insert(orgMembers).values({
        orgId: newOrg.id,
        userId: session.userId!,
        role: "owner",
      });

      // Default home page
      await tx.insert(sitePages).values({
        orgId: newOrg.id,
        title: "Home",
        path: "/",
        type: "home",
      });

      return newOrg;
    });

    // Update session with new orgId
    session.orgId = org.id;
    await session.save();

    return NextResponse.json({ org }, { status: 201 });
  } catch (err) {
    console.error("[create-org]", err);
    return NextResponse.json(errorResponse(err), { status: 500 });
  }
}
