import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { campaigns, campaignWebhooks, orgMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse, statusFor, forbidden, notFound, badRequest } from "@/lib/errors";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Params) {
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
    requireRole(membership, "owner");

    const webhook = await db.query.campaignWebhooks.findFirst({
      where: eq(campaignWebhooks.campaignId, campaign.id),
      columns: { id: true, endpointUrl: true, payloadFields: true, enabled: true, createdAt: true },
      // secretHash intentionally excluded — never expose
    });

    return NextResponse.json({ webhook: webhook ?? null });
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
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
    requireRole(membership, "owner");

    const body = await req.json() as {
      endpointUrl?: string;
      payloadFields?: string[];
      enabled?: boolean;
      rotateSecret?: boolean;
    };

    const existing = await db.query.campaignWebhooks.findFirst({
      where: eq(campaignWebhooks.campaignId, campaign.id),
    });

    let rawSecret: string | undefined;
    let secretHash: string | undefined;

    if (!existing || body.rotateSecret) {
      rawSecret = randomBytes(32).toString("hex");
      secretHash = createHash("sha256").update(rawSecret).digest("hex");
    }

    if (!existing) {
      // Create
      if (!body.endpointUrl) {
        return NextResponse.json(errorResponse(badRequest("endpointUrl required")), { status: 400 });
      }
      const [webhook] = await db
        .insert(campaignWebhooks)
        .values({
          campaignId: campaign.id,
          endpointUrl: body.endpointUrl,
          secretHash: secretHash!,
          payloadFields: body.payloadFields ?? ["*"],
          enabled: body.enabled ?? true,
        })
        .returning({ id: campaignWebhooks.id, endpointUrl: campaignWebhooks.endpointUrl, enabled: campaignWebhooks.enabled });

      // rawSecret shown once — never stored in plaintext
      return NextResponse.json({ webhook, secret: rawSecret });
    } else {
      // Update
      const updates: Partial<typeof campaignWebhooks.$inferInsert> = {};
      if (body.endpointUrl !== undefined) updates.endpointUrl = body.endpointUrl;
      if (body.payloadFields !== undefined) updates.payloadFields = body.payloadFields;
      if (body.enabled !== undefined) updates.enabled = body.enabled;
      if (secretHash) updates.secretHash = secretHash;

      const [webhook] = await db
        .update(campaignWebhooks)
        .set(updates)
        .where(eq(campaignWebhooks.id, existing.id))
        .returning({ id: campaignWebhooks.id, endpointUrl: campaignWebhooks.endpointUrl, enabled: campaignWebhooks.enabled });

      return NextResponse.json({ webhook, secret: rawSecret ?? null });
    }
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}

/** Send a synthetic test event to the configured endpoint */
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
    requireRole(membership, "owner");

    const webhook = await db.query.campaignWebhooks.findFirst({
      where: and(eq(campaignWebhooks.campaignId, campaign.id), eq(campaignWebhooks.enabled, true)),
    });

    if (!webhook) {
      return NextResponse.json(errorResponse(notFound("Webhook")), { status: 404 });
    }

    const body = JSON.stringify({ event: "webhook.test", campaignId: campaign.id });
    // Sign the test event with the same HMAC scheme as live deliveries so the
    // receiver can validate it exactly as a real conversion.
    const signature = createHmac("sha256", webhook.secretHash).update(body).digest("hex");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(webhook.endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Primitive-Signature": signature,
        },
        body,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      return NextResponse.json({ ok: res.ok, status: res.status });
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err) });
    }
  } catch (err) {
    return NextResponse.json(errorResponse(err), { status: statusFor(err) });
  }
}
