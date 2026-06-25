import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignAudienceRecords, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ slug: string; recordId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug, recordId } = await params;
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

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
    const body = await req.json().catch(() => ({}));
    const { name, email, fields } = body ?? {};

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (fields !== undefined && typeof fields === "object") updates.fields = fields;

    const { sql: drizzleSql } = await import("drizzle-orm");
    const [updated] = await db
      .update(campaignAudienceRecords)
      .set(updates)
      .where(
        and(
          eq(campaignAudienceRecords.id, recordId),
          eq(campaignAudienceRecords.campaignId, campaign.id)
        )
      )
      .returning();

    if (!updated) return NextResponse.json(errorResponse(notFound("Record")), { status: 404 });
    return NextResponse.json({ record: updated });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { slug, recordId } = await params;
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

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
    const deleted = await db
      .delete(campaignAudienceRecords)
      .where(
        and(
          eq(campaignAudienceRecords.id, recordId),
          eq(campaignAudienceRecords.campaignId, campaign.id)
        )
      )
      .returning({ id: campaignAudienceRecords.id });

    if (deleted.length === 0) {
      return NextResponse.json(errorResponse(notFound("Record")), { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
