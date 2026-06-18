// Broadcast send engine: resolve recipients (campaign audience + segment),
// render per-recipient HTML, send in Resend batches, track delivery, finalize.

import { db } from "@/lib/db";
import {
  emailBroadcasts,
  emailBroadcastRecipients,
  campaignAudienceRecords,
  organizations,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveBrand } from "@/lib/campaign-engine/theme";
import { evaluateRuleGroup, type RuleGroup } from "@/lib/campaign-engine/branch";
import { sendBatch, emailConfigured } from "@/lib/email";
import {
  renderBroadcastHtml,
} from "@/lib/email/render-broadcast";
import {
  applyMergeTags,
  applyThemeOverride,
  mergeValuesFor,
  type EmailDesign,
} from "@/lib/email/design";
import { unsubscribeUrl } from "@/lib/email/unsubscribe";
import type { CampaignTheme } from "@/lib/campaign-engine/theme";

const BATCH_SIZE = 100;

export interface ResolvedRecipient {
  audienceRecordId: string;
  email: string;
  name: string | null;
  fields: Record<string, unknown>;
}

/** Audience records with an email, filtered by the broadcast's segment. */
export async function resolveRecipients(broadcastId: string): Promise<ResolvedRecipient[]> {
  const broadcast = await db.query.emailBroadcasts.findFirst({
    where: eq(emailBroadcasts.id, broadcastId),
  });
  if (!broadcast) return [];

  const records = await db.query.campaignAudienceRecords.findMany({
    where: eq(campaignAudienceRecords.campaignId, broadcast.campaignId),
  });

  const segment = (broadcast.segmentFilter as RuleGroup | null) ?? null;
  const seen = new Set<string>();
  const out: ResolvedRecipient[] = [];

  for (const r of records) {
    const email = (r.email ?? "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    if (r.unsubscribedAt) { seen.add(email); continue; } // opted out — never email again
    const fields = (r.fields as Record<string, unknown>) ?? {};
    if (segment && !evaluateRuleGroup(segment, { form: {}, url: {}, record: fields })) continue;
    seen.add(email);
    out.push({ audienceRecordId: r.id, email: r.email!.trim(), name: r.name ?? null, fields });
  }
  return out;
}

/** Count recipients for the current segment (used by the editor preview). */
export async function countRecipients(broadcastId: string): Promise<number> {
  return (await resolveRecipients(broadcastId)).length;
}

/** Count emailable audience records for an ad-hoc segment (live editor count). */
export async function countForSegment(campaignId: string, segment: RuleGroup | null): Promise<number> {
  const records = await db.query.campaignAudienceRecords.findMany({
    where: eq(campaignAudienceRecords.campaignId, campaignId),
    columns: { email: true, fields: true, unsubscribedAt: true },
  });
  const seen = new Set<string>();
  let count = 0;
  for (const r of records) {
    const email = (r.email ?? "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    if (r.unsubscribedAt) { seen.add(email); continue; }
    const fields = (r.fields as Record<string, unknown>) ?? {};
    if (segment && !evaluateRuleGroup(segment, { form: {}, url: {}, record: fields })) continue;
    seen.add(email);
    count += 1;
  }
  return count;
}

/** Render one recipient's HTML — used by test send. */
export async function renderForRecipient(
  design: EmailDesign,
  theme: Parameters<typeof renderBroadcastHtml>[1],
  preheader: string,
  values: Record<string, string>,
): Promise<string> {
  const template = await renderBroadcastHtml(design, theme, preheader);
  return applyMergeTags(template, values);
}

interface SendSummary { sent: number; failed: number; skipped: number; total: number; configured: boolean; logged: number }

/**
 * Send (or re-send) a broadcast to its resolved recipients. Idempotent:
 * recipients already marked `sent` are skipped.
 */
export async function sendBroadcast(broadcastId: string): Promise<SendSummary> {
  const broadcast = await db.query.emailBroadcasts.findFirst({
    where: eq(emailBroadcasts.id, broadcastId),
    with: { campaign: { columns: { theme: true, orgId: true } } },
  });
  if (!broadcast) throw new Error("Broadcast not found");

  const configured = emailConfigured();
  await db.update(emailBroadcasts).set({ status: "sending", updatedAt: new Date() }).where(eq(emailBroadcasts.id, broadcastId));

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, broadcast.campaign.orgId),
    columns: { branding: true },
  });
  const theme = applyThemeOverride(
    resolveBrand(org?.branding ?? null, broadcast.campaign.theme ?? null),
    broadcast.themeOverride as Partial<CampaignTheme> | null,
  );

  const design = (broadcast.designJson as EmailDesign) ?? { blocks: [] };
  const template = await renderBroadcastHtml(design, theme, broadcast.preheader);

  const recipients = await resolveRecipients(broadcastId);

  // Idempotency: skip emails already sent for this broadcast.
  const existing = await db.query.emailBroadcastRecipients.findMany({
    where: and(eq(emailBroadcastRecipients.broadcastId, broadcastId), eq(emailBroadcastRecipients.status, "sent")),
    columns: { email: true },
  });
  const alreadySent = new Set(existing.map((e) => e.email.trim().toLowerCase()));
  const pending = recipients.filter((r) => !alreadySent.has(r.email.toLowerCase()));

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const chunk = pending.slice(i, i + BATCH_SIZE);
    const messages = chunk.map((r) => {
      const values = mergeValuesFor(r.name, r.email, r.fields, unsubscribeUrl(r.audienceRecordId));
      return {
        to: r.email,
        subject: applyMergeTags(broadcast.subject, values),
        html: applyMergeTags(template, values),
      };
    });
    const results = await sendBatch(messages);
    const rows = chunk.map((r, j) => {
      const res = results[j];
      if (res?.ok) sent += 1; else failed += 1;
      // Without Resend configured, sendBatch only logged to the console — record
      // those as "skipped" (not "sent") so the user isn't misled and a real send
      // later isn't blocked by idempotency.
      const ok = Boolean(res?.ok);
      return {
        broadcastId,
        audienceRecordId: r.audienceRecordId,
        email: r.email,
        name: r.name,
        status: ok ? (configured ? "sent" : "skipped") : "failed",
        error: ok ? (configured ? null : "Email not configured — logged to server console only") : (res?.error ?? "Unknown error"),
        providerId: res?.id ?? null,
        sentAt: ok && configured ? new Date() : null,
      };
    });
    if (rows.length) await db.insert(emailBroadcastRecipients).values(rows);
  }

  const total = recipients.length;
  // When email isn't configured we only logged — leave the broadcast as a draft
  // so it can be sent for real once Resend is set up.
  const status = !configured ? "draft" : failed > 0 && sent === 0 ? "failed" : "sent";
  await db.update(emailBroadcasts).set({
    status,
    sentCount: configured ? alreadySent.size + sent : 0,
    failedCount: failed,
    recipientCount: total,
    sentAt: configured ? new Date() : null,
    updatedAt: new Date(),
  }).where(eq(emailBroadcasts.id, broadcastId));

  return { sent: configured ? sent : 0, logged: configured ? 0 : sent, failed, skipped: alreadySent.size, total, configured };
}
