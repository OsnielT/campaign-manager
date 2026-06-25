import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignAudienceFields, campaignAudienceRecords, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { generateRecordValues, isGeneratorType, type AudienceFieldLike } from "@/lib/audience/generate";
import { getRequestUser } from "@/lib/auth/session";

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const { userId, orgId } = await getRequestUser(req);
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });

  const [membership, campaign] = await Promise.all([
    db.query.orgMembers.findFirst({ where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)) }),
    db.query.campaigns.findFirst({ where: and(eq(campaigns.orgId, orgId), eq(campaigns.slug, slug)), columns: { id: true } }),
  ]);
  if (!membership) return NextResponse.json(errorResponse(forbidden()), { status: 403 });
  if (!campaign) return NextResponse.json(errorResponse(notFound("Campaign")), { status: 404 });

  try {
    requireRole(membership, "editor");
    const body = await req.json().catch(() => ({}));
    const count = Math.max(1, Math.min(500, Number(body.count) || 25));
    const overrides: Record<string, string> = body.generators && typeof body.generators === "object" ? body.generators : {};

    const fieldRows = await db.query.campaignAudienceFields.findMany({
      where: eq(campaignAudienceFields.campaignId, campaign.id),
      columns: { id: true, key: true, label: true, type: true, generator: true, onActivation: true },
    });
    const fields: AudienceFieldLike[] = fieldRows;

    // Persist any explicitly-chosen generator types back to the fields so the
    // choice sticks for next time (and so templates can inherit them).
    await Promise.all(
      fieldRows
        .filter((f) => isGeneratorType(overrides[f.key]) && overrides[f.key] !== f.generator)
        .map((f) => db.update(campaignAudienceFields).set({ generator: overrides[f.key] }).where(eq(campaignAudienceFields.id, f.id))),
    );

    let inserted = 0;
    let skipped = 0;
    for (let i = 0; i < count; i++) {
      const { name, email, fields: values } = generateRecordValues(fields, overrides);
      const lookupKey = `test-${randomBytes(4).toString("hex")}`;
      const rows = await db
        .insert(campaignAudienceRecords)
        .values({ campaignId: campaign.id, lookupKey, name, email, fields: values })
        .onConflictDoNothing()
        .returning({ id: campaignAudienceRecords.id });
      if (rows.length > 0) inserted++;
      else skipped++;
    }

    return NextResponse.json({ ok: true, inserted, skipped });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
