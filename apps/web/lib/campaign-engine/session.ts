import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaignAudienceRecords, campaignSessions } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

export interface CampaignSessionData {
  sessionId: string;
  campaignId: string;
}

/** Cookie config scoped to a campaign path */
export function campaignSessionOptions(
  orgSlug: string,
  campaignSlug: string
): SessionOptions {
  return {
    cookieName: `cs_${orgSlug}_${campaignSlug}`,
    password: process.env.CAMPAIGN_SESSION_SECRET!,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 24 hours
      path: `/${orgSlug}/${campaignSlug}`,
    },
  };
}

/** Read session cookie from a server action / page context */
export async function getCampaignSession(orgSlug: string, campaignSlug: string) {
  const cookieStore = await cookies();
  return getIronSession<CampaignSessionData>(
    cookieStore,
    campaignSessionOptions(orgSlug, campaignSlug)
  );
}

/** Read session cookie from a request/response pair (route handlers) */
export async function getCampaignSessionFromReq(
  req: NextRequest,
  res: NextResponse,
  orgSlug: string,
  campaignSlug: string
) {
  return getIronSession<CampaignSessionData>(
    req,
    res,
    campaignSessionOptions(orgSlug, campaignSlug)
  );
}

/**
 * Read-only session lookup for server components.
 * Returns the existing session if the cookie is set and the DB row is valid,
 * or null when the visitor has no session yet (first visit).
 */
export async function readSession(
  campaignId: string,
  orgSlug: string,
  campaignSlug: string
) {
  const ironSession = await getCampaignSession(orgSlug, campaignSlug);
  if (!ironSession.sessionId) return null;

  const now = new Date();
  const existing = await db.query.campaignSessions.findFirst({
    where: and(
      eq(campaignSessions.id, ironSession.sessionId),
      eq(campaignSessions.campaignId, campaignId)
    ),
    with: { audienceRecord: true },
  });

  if (existing && existing.expiresAt > now) return existing;
  return null;
}

/**
 * Create a new session and persist the cookie.
 * Only safe to call from a Route Handler or Server Action.
 */
export async function createSession(
  campaignId: string,
  orgSlug: string,
  campaignSlug: string,
  urlParams: Record<string, string>,
  context: Record<string, unknown> = {}
) {
  const now = new Date();
  const visitorToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [newSession] = await db
    .insert(campaignSessions)
    .values({
      campaignId,
      visitorToken,
      urlParams,
      context,
      expiresAt,
    })
    .returning();

  const ironSession = await getCampaignSession(orgSlug, campaignSlug);
  ironSession.sessionId = newSession.id;
  ironSession.campaignId = campaignId;
  await ironSession.save();

  return { ...newSession, audienceRecord: null };
}

/** Merge new form data into an existing session and refresh expiry */
export async function updateSessionFormData(
  sessionId: string,
  newFields: Record<string, unknown>
) {
  const current = await db.query.campaignSessions.findFirst({
    where: eq(campaignSessions.id, sessionId),
    columns: { formData: true },
  });

  const merged = { ...(current?.formData as Record<string, unknown> ?? {}), ...newFields };
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db
    .update(campaignSessions)
    .set({ formData: merged, updatedAt: new Date(), expiresAt })
    .where(eq(campaignSessions.id, sessionId));

  return merged;
}

/** Bind an audience record to a session */
export async function bindAudienceRecord(sessionId: string, audienceRecordId: string) {
  await db
    .update(campaignSessions)
    .set({ audienceRecordId, updatedAt: new Date() })
    .where(eq(campaignSessions.id, sessionId));
}

/** Update the current flow node for a session */
export async function updateSessionNode(sessionId: string, nodeId: string) {
  await db
    .update(campaignSessions)
    .set({ currentNodeId: nodeId, updatedAt: new Date() })
    .where(eq(campaignSessions.id, sessionId));
}

/**
 * Merge fields into an audience record's `fields` JSONB.
 * Existing keys are overwritten; keys not present in `patch` are preserved.
 * Safe no-op if `audienceRecordId` is null.
 */
export async function patchAudienceRecordFields(
  audienceRecordId: string | null,
  patch: Record<string, unknown>
) {
  if (!audienceRecordId || Object.keys(patch).length === 0) return;
  await db
    .update(campaignAudienceRecords)
    .set({ fields: sql`fields || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(campaignAudienceRecords.id, audienceRecordId));
}
