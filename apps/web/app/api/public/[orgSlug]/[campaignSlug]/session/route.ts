import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, campaigns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createSession, readSession } from "@/lib/campaign-engine/session";
import { buildVisitorContext } from "@/lib/campaign-engine/context";
import { rateLimiters, getIp, checkRateLimit } from "@/lib/rate-limit";

type Params = { params: Promise<{ orgSlug: string; campaignSlug: string }> };

/**
 * POST /api/public/[orgSlug]/[campaignSlug]/session
 *
 * Initializes a visitor session cookie. Called by the client component on
 * first visit when the server component found no existing session.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { orgSlug, campaignSlug } = await params;

  const ip = getIp(req);
  const { allowed } = await checkRateLimit(rateLimiters.submit(), ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgSlug),
    columns: { id: true },
  });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.orgId, org.id), eq(campaigns.slug, campaignSlug)),
    columns: { id: true, status: true },
  });
  if (!campaign || campaign.status !== "published") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If a valid session already exists, return it without creating a new one
  const existing = await readSession(campaign.id, orgSlug, campaignSlug);
  if (existing) {
    return NextResponse.json({ sessionId: existing.id });
  }

  const body = await req.json().catch(() => ({}));
  const urlParams = (body.urlParams as Record<string, string>) ?? {};
  const context = buildVisitorContext(req, urlParams) as unknown as Record<string, unknown>;

  const session = await createSession(campaign.id, orgSlug, campaignSlug, urlParams, context);
  return NextResponse.json({ sessionId: session.id });
}
