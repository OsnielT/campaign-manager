import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  organizations,
  campaigns,
  campaignAudienceFields,
  campaignAudienceRecords,
  campaignAudienceLookupLog,
  campaignSessions,
  campaignPages,
  campaignProducts,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCampaignSessionFromReq, bindAudienceRecord, patchAudienceRecordFields } from "@/lib/campaign-engine/session";
import { resolveNextPage } from "@/lib/campaign-engine/flow";
import { rateLimiters, getIp, checkRateLimit } from "@/lib/rate-limit";

type Params = { params: Promise<{ orgSlug: string; campaignSlug: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { orgSlug, campaignSlug } = await params;

  // Rate limit — strict: 10 per IP per minute
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(rateLimiters.lookup(), ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const rawKey: string = (body?.lookupKey ?? "").trim().toLowerCase();
    const pageContext: { title?: string; path?: string } = body?.pageContext ?? {};
    const clientUrlParams: Record<string, string> = body?.urlParams ?? {};
    const identifyOnly: boolean = Boolean(body?.identifyOnly);
    // The campaign session cookie is path-scoped to /{org}/{campaign} and is not
    // sent to this /api/public endpoint, so the client passes the session id
    // explicitly (like the submit endpoint does) to bind the record.
    const bodySessionId: string | null = typeof body?.sessionId === "string" ? body.sessionId : null;

    if (!rawKey) {
      return NextResponse.json({ error: "lookupKey is required" }, { status: 400 });
    }

    // Resolve org + campaign
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, orgSlug),
      columns: { id: true },
    });
    if (!org) return NextResponse.json({ valid: false });

    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.orgId, org.id), eq(campaigns.slug, campaignSlug)),
      columns: { id: true, status: true },
    });
    if (!campaign || campaign.status !== "published") {
      return NextResponse.json({ valid: false });
    }

    const ua = req.headers.get("user-agent");

    // Look up record — fetch fields so we can check already-used state
    const record = await db.query.campaignAudienceRecords.findFirst({
      where: and(
        eq(campaignAudienceRecords.campaignId, campaign.id),
        eq(campaignAudienceRecords.lookupKey, rawKey)
      ),
      columns: { id: true, fields: true },
    });

    const outcome = record ? "matched" : "no_match";

    // Append-only audit log
    await db.insert(campaignAudienceLookupLog).values({
      campaignId: campaign.id,
      audienceRecordId: record?.id ?? null,
      lookupKey: rawKey,
      outcome,
      ipAddress: ip,
      userAgent: ua,
    });

    if (!record) {
      return NextResponse.json({ valid: false });
    }

    // Load activation field mappings for this campaign
    const activationFields = await db.query.campaignAudienceFields.findMany({
      where: eq(campaignAudienceFields.campaignId, campaign.id),
      columns: { key: true, onActivation: true },
    });
    const mappings = activationFields.filter((f) => f.onActivation !== null);

    // Already-used detection: rely solely on the _activated_at sentinel we write on first activation.
    // This key is never in imported CSV data, so it cannot produce false positives regardless
    // of what values the CSV contains.
    const recordFields = record.fields as Record<string, unknown>;
    const activatedAt = recordFields["_activated_at"];
    if (typeof activatedAt === "string" && activatedAt.length > 0) {
      return NextResponse.json({ valid: false, reason: "already_used" });
    }

    // Read session so formData and urlParams are available. Prefer the
    // explicitly-passed session id; fall back to the cookie when present.
    const res = NextResponse.json({ valid: true });
    const ironSession = await getCampaignSessionFromReq(req, res, orgSlug, campaignSlug);
    const effectiveSessionId = ironSession.sessionId || bodySessionId;

    // Bind record to session first so resolveNextPage can use audienceRecordId
    if (effectiveSessionId) {
      await bindAudienceRecord(effectiveSessionId, record.id);
    }

    // Load full DB session for flow resolution (includes urlParams)
    let dbSession: { id: string; campaignId: string; currentNodeId: string | null; audienceRecordId: string | null; urlParams: Record<string, string> | null } | null = null;
    if (effectiveSessionId) {
      const raw = await db.query.campaignSessions.findFirst({
        where: eq(campaignSessions.id, effectiveSessionId),
        columns: { id: true, campaignId: true, currentNodeId: true, audienceRecordId: true, urlParams: true },
      });
      if (raw) {
        dbSession = {
          ...raw,
          urlParams: (raw.urlParams as Record<string, string> | null) ?? null,
        };
      }
    }

    // Resolve next page via flow graph so we can capture the correct offer page title.
    // Always resolve — use DB session when available; fall back to a synthetic session
    // built from clientUrlParams (handles the race where the visitor activates before
    // the session POST has written urlParams to the DB).
    // Merge: client params take priority so a tier click after session creation routes correctly
    const mergedUrlParams = Object.keys(clientUrlParams).length > 0
      ? { ...(dbSession?.urlParams as Record<string, string> ?? {}), ...clientUrlParams }
      : ((dbSession?.urlParams as Record<string, string>) ?? {});

    const flowSession = dbSession
      ? { ...dbSession, urlParams: mergedUrlParams }
      : { id: null, campaignId: campaign.id, currentNodeId: null, audienceRecordId: null, urlParams: mergedUrlParams };
    const { path: nextPath, title: nextPageTitle } = await resolveNextPage(flowSession, {});

    const now = new Date().toISOString();
    const sessionFormData = (ironSession as unknown as { formData?: Record<string, unknown> }).formData ?? {};

    // Lazy-load product name only if needed
    let productName: string | null = null;
    const needsProduct = mappings.some((m) => m.onActivation === "product:name");
    if (needsProduct) {
      const cp = await db.query.campaignProducts.findFirst({
        where: eq(campaignProducts.campaignId, campaign.id),
        with: { orgProduct: { columns: { name: true } } },
      });
      productName = cp?.orgProduct?.name ?? null;
    }

    // Lazy-load URL params only if needed
    let urlParams: Record<string, string> | null = null;
    const needsUrlParams = mappings.some((m) => m.onActivation?.startsWith("url:"));
    if (needsUrlParams && dbSession?.urlParams) {
      urlParams = dbSession.urlParams;
    }

    // Build patch from configured field mappings
    const patch: Record<string, string> = {};
    // Only stamp activation sentinel when this is the real activation step (not identify-only gateway)
    if (!identifyOnly) {
      patch._activated_at = now;
    }
    for (const m of mappings) {
      if (!m.onActivation) continue;
      if (m.onActivation === "timestamp") {
        patch[m.key] = now;
      } else if (m.onActivation.startsWith("fixed:")) {
        patch[m.key] = m.onActivation.slice(6);
      } else if (m.onActivation === "page:title") {
        // Use the resolved next page title so the offer field captures e.g. "Offer A", not the entry page
        patch[m.key] = nextPageTitle ?? pageContext.title ?? "";
      } else if (m.onActivation === "page:path") {
        patch[m.key] = nextPath !== "/" ? nextPath : (pageContext.path ?? "");
      } else if (m.onActivation === "product:name") {
        if (productName) patch[m.key] = productName;
      } else if (m.onActivation.startsWith("form:")) {
        const formKey = m.onActivation.slice(5);
        const formValue = sessionFormData[formKey];
        if (formValue !== undefined && formValue !== null) {
          patch[m.key] = String(formValue);
        }
      } else if (m.onActivation.startsWith("url:")) {
        const paramName = m.onActivation.slice(4);
        const paramValue = urlParams?.[paramName];
        if (paramValue !== undefined) patch[m.key] = String(paramValue);
      } else if (/^page:[^:]+:(title|path)$/.test(m.onActivation)) {
        const parts = m.onActivation.split(":");
        const pageId = parts[1];
        const field = parts[2] as "title" | "path";
        const campaignPage = await db.query.campaignPages.findFirst({
          where: eq(campaignPages.id, pageId),
          columns: { title: true, path: true },
        });
        if (campaignPage) patch[m.key] = campaignPage[field] ?? "";
      }
    }
    await patchAudienceRecordFields(record.id, patch);

    // Return nextPath so the client can navigate to the correct offer page
    return NextResponse.json({ valid: true, nextPath });
  } catch (err) {
    console.error("[lookup]", err);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
