import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const userId = req.headers.get("x-user-id")!;

  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  try {
    requireRole(membership, "owner");

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if ("name" in body) {
      if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
      updates.name = body.name;
    }
    if ("branding" in body) {
      updates.branding = body.branding ?? null;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { id: true },
    });
    if (!org) return NextResponse.json(errorResponse(notFound("Org")), { status: 404 });

    const [updated] = await db
      .update(organizations)
      .set(updates)
      .where(eq(organizations.id, orgId))
      .returning();

    return NextResponse.json({ org: updated });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
