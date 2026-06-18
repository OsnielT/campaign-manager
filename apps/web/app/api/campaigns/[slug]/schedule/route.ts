import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const userId = req.headers.get("x-user-id")!;
  const orgId = req.headers.get("x-org-id")!;

  const [membership, campaign] = await Promise.all([
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)),
      columns: { id: true, status: true },
    }),
  ]);

  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");

    const body = await req.json();
    const { scheduledAt, cancel } = body ?? {};

    if (cancel) {
      if (campaign.status !== "scheduled") {
        return NextResponse.json(
          errorResponse(badRequest("Campaign is not scheduled")),
          { status: 400 }
        );
      }
      const [updated] = await db
        .update(campaigns)
        .set({ status: "draft", scheduledAt: null, updatedAt: new Date() })
        .where(eq(campaigns.id, campaign.id))
        .returning();
      return NextResponse.json({ campaign: updated });
    }

    if (!scheduledAt) {
      return NextResponse.json(
        errorResponse(badRequest("scheduledAt is required")),
        { status: 400 }
      );
    }

    const date = new Date(scheduledAt);
    if (isNaN(date.getTime()) || date <= new Date()) {
      return NextResponse.json(
        errorResponse(badRequest("scheduledAt must be a future date")),
        { status: 400 }
      );
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        errorResponse(badRequest("Only draft campaigns can be scheduled")),
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(campaigns)
      .set({ status: "scheduled", scheduledAt: date, updatedAt: new Date() })
      .where(eq(campaigns.id, campaign.id))
      .returning();

    return NextResponse.json({ campaign: updated });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
