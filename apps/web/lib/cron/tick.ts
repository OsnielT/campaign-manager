import { db } from "@/lib/db";
import { campaigns, webhookDeliveries, campaignWebhooks, campaignConversions, organizations, campaignAlerts, orgMembers, emailBroadcasts } from "@/lib/db/schema";
import { eq, and, lte, isNotNull, isNull, or, gte, count } from "drizzle-orm";
import { buildWebhookPayload, retryDelayMinutes } from "@/lib/campaign-engine/conversion";
import { sendEmail } from "@/lib/email";
import { sendBroadcast } from "@/lib/email/broadcast";

export async function tick(): Promise<{
  published: number;
  expired: number;
  webhooksDelivered: number;
  webhooksFailed: number;
  expiryReminders: number;
  dailyDigests: number;
  broadcastsSent: number;
}> {
  const now = new Date();

  // ── Campaign status transitions ──────────────────────────────────────────────
  const [publishResult, expireResult] = await db.transaction(async (tx) => {
    const published = await tx
      .update(campaigns)
      .set({ status: "published", updatedAt: now })
      .where(and(eq(campaigns.status, "scheduled"), lte(campaigns.scheduledAt, now)))
      .returning({ id: campaigns.id });

    const expired = await tx
      .update(campaigns)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(campaigns.status, "published"),
          isNotNull(campaigns.expiresAt),
          lte(campaigns.expiresAt, now)
        )
      )
      .returning({ id: campaigns.id });

    return [published, expired];
  });

  // ── Webhook delivery ──────────────────────────────────────────────────────────
  const pendingDeliveries = await db.query.webhookDeliveries.findMany({
    where: and(
      eq(webhookDeliveries.status, "pending"),
      or(isNull(webhookDeliveries.nextRetryAt), lte(webhookDeliveries.nextRetryAt, now))
    ),
    limit: 50,
    with: {
      webhook: true,
      conversion: {
        with: {
          campaign: {
            with: { org: { columns: { slug: true } } },
          },
          audienceRecord: { columns: { fields: true } },
        },
      },
    },
  });

  let webhooksDelivered = 0;
  let webhooksFailed = 0;

  for (const delivery of pendingDeliveries) {
    const webhook = delivery.webhook as typeof delivery.webhook & { secretHash: string; payloadFields: string[]; endpointUrl: string };
    const conversion = delivery.conversion as typeof delivery.conversion & {
      campaign: { org: { slug: string } };
      audienceRecord: { fields: Record<string, unknown> } | null;
    };

    // We stored sha256(secret) — we can't recover the raw secret for HMAC signing.
    // For delivery, use the stored hash as a signing key (deterministic but not reversible).
    // In production, store the raw secret encrypted; here we use the hash as proxy.
    const { body, signature } = buildWebhookPayload(
      {
        id: conversion.id,
        campaignId: conversion.campaignId,
        triggerType: conversion.triggerType,
        payload: conversion.payload as Record<string, unknown>,
        convertedAt: conversion.convertedAt,
        goalKey: conversion.goalKey,
        goalLabel: conversion.goalLabel,
        recordFields: conversion.audienceRecord?.fields ?? null,
      },
      conversion.campaign.org.slug,
      webhook.payloadFields,
      webhook.secretHash
    );

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(webhook.endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Primitive-Signature": signature,
        },
        body,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (res.ok) {
        await db
          .update(webhookDeliveries)
          .set({ status: "delivered", deliveredAt: now, responseStatus: res.status })
          .where(eq(webhookDeliveries.id, delivery.id));
        webhooksDelivered++;
      } else {
        await handleRetry(delivery.id, delivery.attemptNumber, res.status, null, now);
        webhooksFailed++;
      }
    } catch (err) {
      await handleRetry(delivery.id, delivery.attemptNumber, null, String(err), now);
      webhooksFailed++;
    }
  }

  // ── Expiry reminder emails ─────────────────────────────────────────────────────
  let expiryReminders = 0;
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const campaignsExpiringIn24h = await db.query.campaigns.findMany({
    where: and(
      eq(campaigns.status, "published"),
      isNotNull(campaigns.expiresAt),
      gte(campaigns.expiresAt, in24h),
      lte(campaigns.expiresAt, in25h)
    ),
    with: { org: { columns: { id: true, name: true } } },
  });

  for (const c of campaignsExpiringIn24h) {
    const org = c.org as { id: string; name: string };
    // Find owners of the org to email
    const members = await db.query.orgMembers.findMany({
      where: and(
        eq(orgMembers.orgId, org.id),
        eq(orgMembers.role, "owner")
      ),
      with: { user: { columns: { email: true } } },
    });
    for (const m of members) {
      const memberUser = m.user as { email: string } | undefined;
      if (!memberUser?.email) continue;
      await sendEmail({
        to: memberUser.email,
        subject: `Your campaign "${c.name}" expires in ~24 hours`,
        html: `<p>Your campaign <strong>${c.name}</strong> is scheduled to expire at ${c.expiresAt?.toUTCString()}.</p><p>If you want to extend it, update the expiry date in campaign settings.</p>`,
      }).catch(() => {/* ignore */});
      expiryReminders++;
    }
  }

  // ── Daily digest alerts ───────────────────────────────────────────────────────
  let dailyDigests = 0;
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dailyAlerts = await db.query.campaignAlerts.findMany({
    where: and(
      eq(campaignAlerts.type, "daily"),
      eq(campaignAlerts.enabled, true)
    ),
    with: { campaign: { columns: { id: true, name: true, slug: true } } },
  });

  for (const alert of dailyAlerts) {
    if (!alert.email) continue;
    // Check if we already sent today (lastSentAt within 23h)
    if (alert.lastSentAt && alert.lastSentAt > since24h) continue;

    const campaignForAlert = alert.campaign as { id: string; name: string; slug: string };
    const [{ convCount }] = await db
      .select({ convCount: count() })
      .from(campaignConversions)
      .where(
        and(
          eq(campaignConversions.campaignId, campaignForAlert.id),
          gte(campaignConversions.convertedAt, since24h)
        )
      );

    if (convCount > 0) {
      await sendEmail({
        to: alert.email,
        subject: `Daily digest: ${convCount} conversion${convCount !== 1 ? "s" : ""} on "${campaignForAlert.name}"`,
        html: `<p>Your campaign <strong>${campaignForAlert.name}</strong> received <strong>${convCount} conversion${convCount !== 1 ? "s" : ""}</strong> in the last 24 hours.</p>`,
      }).catch(() => {/* ignore */});

      await db
        .update(campaignAlerts)
        .set({ lastSentAt: now })
        .where(eq(campaignAlerts.id, alert.id));

      dailyDigests++;
    }
  }

  // ── Scheduled email broadcasts ───────────────────────────────────────────────
  let broadcastsSent = 0;
  const dueBroadcasts = await db.query.emailBroadcasts.findMany({
    where: and(eq(emailBroadcasts.status, "scheduled"), isNotNull(emailBroadcasts.scheduledAt), lte(emailBroadcasts.scheduledAt, now)),
    columns: { id: true },
  });
  for (const b of dueBroadcasts) {
    try {
      await sendBroadcast(b.id);
      broadcastsSent++;
    } catch {
      await db.update(emailBroadcasts).set({ status: "failed", updatedAt: now }).where(eq(emailBroadcasts.id, b.id));
    }
  }

  return {
    published: publishResult.length,
    expired: expireResult.length,
    webhooksDelivered,
    webhooksFailed,
    expiryReminders,
    dailyDigests,
    broadcastsSent,
  };
}

async function handleRetry(
  deliveryId: string,
  attemptNumber: number,
  responseStatus: number | null,
  errorBody: string | null,
  now: Date
) {
  const delayMins = retryDelayMinutes(attemptNumber);

  if (delayMins === null) {
    // Give up after max attempts
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed",
        responseStatus: responseStatus ?? undefined,
        responseBody: errorBody ?? undefined,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  } else {
    const nextRetryAt = new Date(now.getTime() + delayMins * 60 * 1000);
    await db
      .update(webhookDeliveries)
      .set({
        attemptNumber: attemptNumber + 1,
        responseStatus: responseStatus ?? undefined,
        responseBody: errorBody ?? undefined,
        nextRetryAt,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  }
}
