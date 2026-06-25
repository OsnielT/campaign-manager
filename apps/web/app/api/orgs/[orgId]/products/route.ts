import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orgProducts, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, badRequest } from "@/lib/errors";
import { eq, and, desc } from "drizzle-orm";
import { getRequestUser } from "@/lib/auth/session";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const { userId } = await getRequestUser(req);;

  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  try {
    requireRole(membership, "viewer");

    const products = await db.query.orgProducts.findMany({
      where: eq(orgProducts.orgId, orgId),
      orderBy: [desc(orgProducts.createdAt)],
    });

    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const { userId } = await getRequestUser(req);;

  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });

  try {
    requireRole(membership, "editor");

    const body = await req.json() as { name?: string; description?: string; imageUrl?: string; metadata?: Record<string, unknown> };
    if (!body.name?.trim()) {
      return NextResponse.json(errorResponse(badRequest("name required")), { status: 400 });
    }

    const [product] = await db
      .insert(orgProducts)
      .values({
        orgId,
        name: body.name.trim(),
        description: body.description ?? null,
        imageUrl: body.imageUrl ?? null,
        metadata: body.metadata ?? {},
      })
      .returning();

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
