import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orgProducts, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ orgId: string; productId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { orgId, productId } = await params;
  const userId = req.headers.get("x-user-id")!;

  const [membership, product] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.orgProducts.findFirst({
      where: and(eq(orgProducts.id, productId), eq(orgProducts.orgId, orgId)),
    }),
  ]);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!product) return NextResponse.json(errorResponse(notFound("Product")), { status: 404 });

  try {
    requireRole(membership, "editor");

    const body = await req.json() as Partial<typeof orgProducts.$inferInsert>;
    const updates: Partial<typeof orgProducts.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
    if (body.metadata !== undefined) updates.metadata = body.metadata;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(orgProducts)
      .set(updates)
      .where(eq(orgProducts.id, productId))
      .returning();

    return NextResponse.json({ product: updated });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { orgId, productId } = await params;
  const userId = req.headers.get("x-user-id")!;

  const [membership, product] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.orgProducts.findFirst({
      where: and(eq(orgProducts.id, productId), eq(orgProducts.orgId, orgId)),
    }),
  ]);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!product) return NextResponse.json(errorResponse(notFound("Product")), { status: 404 });

  try {
    requireRole(membership, "editor");
    await db.delete(orgProducts).where(eq(orgProducts.id, productId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
