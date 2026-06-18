import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignPreviewTokens, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

type Params = { params: Promise<{ slug: string }> };

// POST — generate a new 72h preview token
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

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    await db.insert(campaignPreviewTokens).values({
      campaignId: campaign.id,
      tokenHash,
      expiresAt,
      createdBy: userId,
    });

    return NextResponse.json({ token: rawToken, expiresAt: expiresAt.toISOString() }, { status: 201 });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

// DELETE — revoke all preview tokens for a campaign
export async function DELETE(req: NextRequest, { params }: Params) {
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
    await db
      .update(campaignPreviewTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(campaignPreviewTokens.campaignId, campaign.id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
