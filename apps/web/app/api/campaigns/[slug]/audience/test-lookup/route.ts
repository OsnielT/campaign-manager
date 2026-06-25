import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignAudienceRecords, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
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
    const { lookupKey } = body ?? {};
    if (!lookupKey || typeof lookupKey !== "string") {
      return NextResponse.json(errorResponse(badRequest("lookupKey is required")), { status: 400 });
    }

    // Hash the key exactly as the public lookup does
    const keyHash = createHash("sha256").update(lookupKey.trim()).digest("hex");

    const record = await db.query.campaignAudienceRecords.findFirst({
      where: and(
        eq(campaignAudienceRecords.campaignId, campaign.id),
        eq(campaignAudienceRecords.lookupKey, keyHash)
      ),
    });

    if (!record) {
      return NextResponse.json({ found: false, record: null });
    }

    return NextResponse.json({
      found: true,
      record: {
        id: record.id,
        name: record.name,
        email: record.email,
        fields: record.fields,
        createdAt: record.createdAt,
        isActivated: !!(record.fields as Record<string, unknown>)["_activated_at"],
      },
    });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
