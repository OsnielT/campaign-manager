import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignProducts, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { getRequestUser } from "@/lib/auth/session";

type Params = { params: Promise<{ slug: string; productId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { slug, productId } = await params;
  const { userId, orgId } = await getRequestUser(req);
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });

  const [membership, campaign] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)),
      columns: { id: true },
    }),
  ]);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");

    const cp = await db.query.campaignProducts.findFirst({
      where: and(eq(campaignProducts.id, productId), eq(campaignProducts.campaignId, campaign.id)),
    });
    if (!cp) return NextResponse.json(errorResponse(notFound("Campaign product")), { status: 404 });

    const body = await req.json() as Partial<typeof campaignProducts.$inferInsert>;
    const updates: Partial<typeof campaignProducts.$inferInsert> = {};
    if (body.nameOverride !== undefined) updates.nameOverride = body.nameOverride;
    if (body.descriptionOverride !== undefined) updates.descriptionOverride = body.descriptionOverride;
    if (body.imageUrlOverride !== undefined) updates.imageUrlOverride = body.imageUrlOverride;
    if (body.metadataOverride !== undefined) updates.metadataOverride = body.metadataOverride;
    if (body.position !== undefined) updates.position = body.position;

    const [updated] = await db
      .update(campaignProducts)
      .set(updates)
      .where(eq(campaignProducts.id, productId))
      .returning();

    return NextResponse.json({ product: updated });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { slug, productId } = await params;
  const { userId, orgId } = await getRequestUser(req);
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });

  const [membership, campaign] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)),
      columns: { id: true },
    }),
  ]);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");
    await db
      .delete(campaignProducts)
      .where(and(eq(campaignProducts.id, productId), eq(campaignProducts.campaignId, campaign.id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
