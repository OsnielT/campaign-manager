import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  campaigns,
  campaignAudienceFields,
  campaignAudienceRecords,
  orgMembers,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and, isNotNull } from "drizzle-orm";
import { getRequestUser } from "@/lib/auth/session";

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
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

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(errorResponse(badRequest("CSV file required")), { status: 400 });
    }

    const text = await (file as Blob).text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) {
      return NextResponse.json(errorResponse(badRequest("CSV must have headers + at least one row")), { status: 400 });
    }

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

    if (!headers.includes("lookup_key")) {
      return NextResponse.json(errorResponse(badRequest("CSV must include a 'lookup_key' column")), { status: 400 });
    }

    // All columns except lookup_key become audience fields
    const csvFields = headers.filter((h) => h !== "lookup_key");

    // Auto-register any new fields from CSV headers (onConflictDoNothing preserves existing label/type)
    if (csvFields.length > 0) {
      await db
        .insert(campaignAudienceFields)
        .values(
          csvFields.map((key, i) => ({
            campaignId: campaign.id,
            key,
            label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            type: "text" as const,
            required: false,
            position: i,
          }))
        )
        .onConflictDoNothing();
    }

    // Load activation-configured fields so we can blank them out on import.
    // These columns are written by the system on activation — pre-existing CSV values
    // would cause false "already used" detection.
    const activationFields = await db.query.campaignAudienceFields.findMany({
      where: and(
        eq(campaignAudienceFields.campaignId, campaign.id),
        isNotNull(campaignAudienceFields.onActivation)
      ),
      columns: { key: true },
    });
    const activationKeys = new Set(activationFields.map((f) => f.key));

    const errors: string[] = [];
    const toInsert: { campaignId: string; lookupKey: string; fields: Record<string, unknown> }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });

      const rawKey = row["lookup_key"]?.trim().toLowerCase();
      if (!rawKey) {
        errors.push(`Row ${i}: lookup_key is empty — skipped`);
        continue;
      }

      toInsert.push({
        campaignId: campaign.id,
        lookupKey: rawKey,
        // Blank out activation-managed fields so they can only be set by the system
        fields: Object.fromEntries(csvFields.map((k) => [k, activationKeys.has(k) ? "" : (row[k] ?? "")])),
      });
    }

    // Insert — skip existing keys (conflict on campaignId + lookupKey)
    let inserted = 0;
    let skipped = 0;
    for (const record of toInsert) {
      const rows = await db
        .insert(campaignAudienceRecords)
        .values(record)
        .onConflictDoNothing()
        .returning({ id: campaignAudienceRecords.id });
      if (rows.length > 0) inserted++;
      else skipped++;
    }

    return NextResponse.json({
      ok: true,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
