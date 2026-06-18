import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  campaigns,
  campaignSessions,
  campaignFlowNodes,
  campaignAlerts,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getCampaignSessionFromReq,
  updateSessionFormData,
  patchAudienceRecordFields,
} from "@/lib/campaign-engine/session";
import { resolveNextPage } from "@/lib/campaign-engine/flow";
import { recordConversion } from "@/lib/campaign-engine/conversion";
import { sendEmail } from "@/lib/email";
import { rateLimiters, getIp, checkRateLimit } from "@/lib/rate-limit";

type Params = { params: Promise<{ orgSlug: string; campaignSlug: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { orgSlug, campaignSlug } = await params;

  // Rate limit
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(rateLimiters.submit(), ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Parse form body (application/x-www-form-urlencoded or JSON)
  let fields: Record<string, string> = {};
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    fields = Object.fromEntries(new URLSearchParams(text));
  } else {
    fields = (await req.json()) ?? {};
  }

  // With the page-level form, per-button metadata rides on the submit button's
  // formAction query string (so multiple buttons stay distinguishable); fall
  // back to body fields for the legacy per-component form path.
  const q = new URL(req.url).searchParams;
  const sessionId = fields._sessionId || q.get("_sessionId") || undefined;
  const conversionTrigger = (q.get("_conversionTrigger") ?? fields._conversionTrigger) === "1";
  const triggerType = ((q.get("_triggerType") || fields._triggerType) as
    | "form_submit"
    | "button_click") || "form_submit";
  const triggerElementId = q.get("_triggerElementId") ?? fields._triggerElementId ?? null;

  // Strip internal fields
  const userFields = Object.fromEntries(
    Object.entries(fields).filter(([k]) => !k.startsWith("_"))
  );

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }

  // Load session
  const session = await db.query.campaignSessions.findFirst({
    where: eq(campaignSessions.id, sessionId),
    with: { audienceRecord: { columns: { id: true, fields: true } } },
  });

  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json({ error: "Session expired" }, { status: 400 });
  }

  // Merge form data into session
  const mergedFormData = await updateSessionFormData(sessionId, userFields);

  // Write form fields back to the linked audience record (JSONB merge — preserves existing keys)
  await patchAudienceRecordFields(session.audienceRecordId, userFields);

  // Resolve next page via flow graph. This may run action nodes (mutating the
  // audience record) and detect when the resolved page is terminal (reaches a
  // named-goal End node).
  const { path: nextPath, goal } = await resolveNextPage(
    {
      ...session,
      urlParams: (session.urlParams as Record<string, string> | null) ?? null,
      context: (session.context as Record<string, unknown> | undefined) ?? undefined,
      sessionStart: session.createdAt?.getTime(),
      seed: session.visitorToken,
      // Record reflects this submission's values (already patched above), so
      // `record.*` routing conditions see the latest data. Null when no record
      // is linked, so `record.*` conditions don't accidentally match form data.
      recordFields: session.audienceRecordId
        ? {
            ...((session.audienceRecord?.fields as Record<string, unknown> | undefined) ?? {}),
            ...userFields,
          }
        : null,
    },
    mergedFormData
  );

  // Record a conversion when the form explicitly triggers one OR the visitor
  // reached a terminal goal. A reached goal always counts as a conversion.
  if (conversionTrigger || goal) {
    const ua = req.headers.get("user-agent");
    const currentPage = session.currentNodeId
      ? await db.query.campaignFlowNodes.findFirst({
          where: eq(campaignFlowNodes.id, session.currentNodeId),
          columns: { pageId: true },
        })
      : null;

    await recordConversion({
      campaignId: session.campaignId,
      sessionId,
      audienceRecordId: session.audienceRecordId ?? null,
      triggerType: goal ? "page_reach" : triggerType,
      triggerPageId: currentPage?.pageId ?? null,
      triggerElementId,
      goalKey: goal?.key ?? null,
      goalLabel: goal?.label ?? null,
      payload: mergedFormData,
      ipAddress: ip,
      userAgent: ua,
    });

    // Fire "each" conversion alerts (fire-and-forget, don't delay the response)
    db.query.campaignAlerts.findMany({
      where: and(
        eq(campaignAlerts.campaignId, session.campaignId),
        eq(campaignAlerts.type, "each"),
        eq(campaignAlerts.enabled, true)
      ),
    }).then(async (alerts) => {
      for (const alert of alerts) {
        if (!alert.email) continue;
        const campaign = await db.query.campaigns.findFirst({
          where: eq(campaigns.id, session.campaignId),
          columns: { name: true, slug: true },
        });
        await sendEmail({
          to: alert.email,
          subject: `New conversion — ${campaign?.name ?? "Campaign"}`,
          html: `<p>A visitor just converted on <strong>${campaign?.name ?? "your campaign"}</strong>.</p><p>Trigger: ${triggerType}</p><p>Time: ${new Date().toUTCString()}</p>`,
        }).catch(() => {/* ignore email errors */});
      }
    }).catch(() => {/* ignore */});
  }

  // A "/" result means the flow had no forward page (dead-end, or it reached an
  // End node). Bouncing to "/" would re-trigger an auto-advance entry page in an
  // infinite loop, so keep the visitor on the page they're already on.
  let redirectPath = nextPath;
  if (nextPath === "/" && session.currentNodeId) {
    const curNode = await db.query.campaignFlowNodes.findFirst({
      where: eq(campaignFlowNodes.id, session.currentNodeId),
      with: { page: { columns: { path: true } } },
    });
    const curPath = (curNode?.page as { path: string } | null | undefined)?.path;
    if (curPath && curPath !== "/") redirectPath = curPath;
  }

  return NextResponse.redirect(
    new URL(`/${orgSlug}/${campaignSlug}${redirectPath}`, req.url),
    303
  );
}
