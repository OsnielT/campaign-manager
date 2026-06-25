import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  campaigns,
  campaignAudienceFields,
  orgMembers,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and, asc, inArray } from "drizzle-orm";
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

  const fields = await db.query.campaignAudienceFields.findMany({
    where: eq(campaignAudienceFields.campaignId, campaign.id),
    orderBy: [asc(campaignAudienceFields.position)],
  });
  return NextResponse.json({ fields });
}

export async function POST(
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
    const body = await req.json();
    const { fields } = body ?? {};
    if (!Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json(errorResponse(badRequest("fields array is required")), { status: 400 });
    }

    // Replace all fields (wizard flow: define once before import)
    await db.delete(campaignAudienceFields).where(eq(campaignAudienceFields.campaignId, campaign.id));
    const inserted = await db
      .insert(campaignAudienceFields)
      .values(
        fields.map((f: { key: string; label: string; type: string; required?: boolean }, i: number) => ({
          campaignId: campaign.id,
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required ?? false,
          position: i,
        }))
      )
      .returning();

    return NextResponse.json({ fields: inserted }, { status: 201 });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

/**
 * PATCH /api/campaigns/[slug]/audience/fields
 * Body: { updates: [{ id: string; onActivation: string | null }] }
 * Updates the on_activation setting for each specified field.
 */
export async function PATCH(
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
    const body = await req.json();
    const updates: { id: string; onActivation: string | null }[] = body.updates ?? [];

    if (updates.length === 0) return NextResponse.json({ ok: true });

    // Verify all field IDs belong to this campaign
    const ids = updates.map((u) => u.id);
    const existing = await db.query.campaignAudienceFields.findMany({
      where: and(
        eq(campaignAudienceFields.campaignId, campaign.id),
        inArray(campaignAudienceFields.id, ids)
      ),
      columns: { id: true },
    });
    const validIds = new Set(existing.map((f) => f.id));

    await Promise.all(
      updates
        .filter((u) => validIds.has(u.id))
        .map((u) =>
          db
            .update(campaignAudienceFields)
            .set({ onActivation: u.onActivation })
            .where(eq(campaignAudienceFields.id, u.id))
        )
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
