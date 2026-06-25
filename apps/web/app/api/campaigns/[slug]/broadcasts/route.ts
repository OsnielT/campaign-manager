import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, emailBroadcasts, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound } from "@/lib/errors";
import { eq, and, desc } from "drizzle-orm";
import { defaultDesign } from "@/lib/email/design";

async function resolve(slug: string, userId: string, orgId: string) {
  const [membership, campaign] = await Promise.all([
    db.query.orgMembers.findFirst({ where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)) }),
    db.query.campaigns.findFirst({ where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)), columns: { id: true } }),
  ]);
  return { membership, campaign };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { membership, campaign } = await resolve(slug, req.headers.get("x-user-id")!, req.headers.get("x-org-id")!);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  const broadcasts = await db.query.emailBroadcasts.findMany({
    where: eq(emailBroadcasts.campaignId, campaign.id),
    orderBy: [desc(emailBroadcasts.createdAt)],
  });
  return NextResponse.json({ broadcasts });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const userId = req.headers.get("x-user-id")!;
  const { membership, campaign } = await resolve(slug, userId, req.headers.get("x-org-id")!);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");
    const [broadcast] = await db.insert(emailBroadcasts).values({
      campaignId: campaign.id,
      name: "Untitled broadcast",
      subject: "",
      designJson: defaultDesign(),
      createdBy: userId,
    }).returning();
    return NextResponse.json({ broadcast });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
