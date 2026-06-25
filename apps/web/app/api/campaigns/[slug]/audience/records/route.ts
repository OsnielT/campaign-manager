import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignAudienceRecords, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and, desc, count, or, ilike } from "drizzle-orm";
import { getRequestUser } from "@/lib/auth/session";

async function resolve(orgId: string, userId: string, slug: string) {
  const [membership, campaign] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)),
      columns: { id: true },
    }),
  ]);
  return { membership, campaign };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { userId, orgId } = await getRequestUser(req);
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });
  const { membership, campaign } = await resolve(orgId, userId, slug);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
    const offset = (page - 1) * limit;
    const search = url.searchParams.get("search")?.trim() ?? "";

    const baseWhere = eq(campaignAudienceRecords.campaignId, campaign.id);
    const where = search
      ? and(baseWhere, or(
          ilike(campaignAudienceRecords.name, `%${search}%`),
          ilike(campaignAudienceRecords.email, `%${search}%`)
        ))
      : baseWhere;

    const [records, [{ total }]] = await Promise.all([
      db.query.campaignAudienceRecords.findMany({
        where,
        orderBy: [desc(campaignAudienceRecords.createdAt)],
        limit,
        offset,
        columns: { campaignId: false },
      }),
      db.select({ total: count() })
        .from(campaignAudienceRecords)
        .where(where),
    ]);

    return NextResponse.json({ records, total, page, limit }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

/** DELETE /api/campaigns/[slug]/audience/records — truncate all records, keep field definitions */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { userId, orgId } = await getRequestUser(req);
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });
  const { membership, campaign } = await resolve(orgId, userId, slug);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");
    await db.delete(campaignAudienceRecords).where(eq(campaignAudienceRecords.campaignId, campaign.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
