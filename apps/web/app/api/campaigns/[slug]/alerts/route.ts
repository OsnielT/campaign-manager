import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignAlerts, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { getRequestUser } from "@/lib/auth/session";

type Params = { params: Promise<{ slug: string }> };

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

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const { userId, orgId } = await getRequestUser(req);
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });
  const { membership, campaign } = await resolve(orgId, userId, slug);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");
    const alerts = await db.query.campaignAlerts.findMany({
      where: eq(campaignAlerts.campaignId, campaign.id),
    });
    return NextResponse.json({ alerts });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const { userId, orgId } = await getRequestUser(req);
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });
  const { membership, campaign } = await resolve(orgId, userId, slug);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");

    const body = await req.json().catch(() => ({}));
    const { alerts: inputAlerts } = body ?? {};
    if (!Array.isArray(inputAlerts)) {
      return NextResponse.json(errorResponse(badRequest("alerts array is required")), { status: 400 });
    }

    const VALID_TYPES = ["each", "threshold", "daily"] as const;
    type AlertType = typeof VALID_TYPES[number];

    const saved: typeof campaignAlerts.$inferSelect[] = [];

    for (const a of inputAlerts) {
      if (!VALID_TYPES.includes(a.type)) continue;
      const type = a.type as AlertType;

      // Upsert by campaignId + type
      const existing = await db.query.campaignAlerts.findFirst({
        where: and(eq(campaignAlerts.campaignId, campaign.id), eq(campaignAlerts.type, type)),
      });

      if (existing) {
        const [updated] = await db
          .update(campaignAlerts)
          .set({
            enabled: !!a.enabled,
            email: a.email ?? null,
            threshold: a.threshold ?? null,
            timezone: a.timezone ?? null,
          })
          .where(eq(campaignAlerts.id, existing.id))
          .returning();
        saved.push(updated);
      } else {
        const [created] = await db
          .insert(campaignAlerts)
          .values({
            campaignId: campaign.id,
            type,
            enabled: !!a.enabled,
            email: a.email ?? null,
            threshold: a.threshold ?? null,
            timezone: a.timezone ?? null,
          })
          .returning();
        saved.push(created);
      }
    }

    return NextResponse.json({ alerts: saved });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
