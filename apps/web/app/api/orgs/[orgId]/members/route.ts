import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orgMembers, users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";

async function getMembership(orgId: string, userId: string) {
  return db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const userId = req.headers.get("x-user-id")!;

  const membership = await getMembership(orgId, userId);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  const members = await db
    .select({
      id: orgMembers.id,
      role: orgMembers.role,
      joinedAt: orgMembers.joinedAt,
      userId: orgMembers.userId,
      name: users.name,
      email: users.email,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId));

  return NextResponse.json({ members });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const userId = req.headers.get("x-user-id")!;
  const { targetUserId } = await req.json();

  const membership = await getMembership(orgId, userId);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  try {
    requireRole(membership, "owner");

    if (targetUserId === userId) {
      return NextResponse.json(
        { error: "Owners cannot remove themselves" },
        { status: 400 }
      );
    }

    const target = await getMembership(orgId, targetUserId);
    if (!target) return NextResponse.json(errorResponse(notFound("Member")), { status: 404 });

    await db
      .delete(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUserId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
