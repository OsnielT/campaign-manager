import { createHash, createHmac } from "crypto";
import { db } from "@/lib/db";
import {
  campaignConversions,
  campaignSessions,
  campaignWebhooks,
  webhookDeliveries,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface RecordConversionInput {
  campaignId: string;
  sessionId: string;
  audienceRecordId: string | null;
  triggerType: "form_submit" | "page_reach" | "button_click";
  triggerPageId: string | null;
  triggerElementId: string | null;
  /** Named goal reached (from the End node), when this conversion ends a flow. */
  goalKey?: string | null;
  goalLabel?: string | null;
  payload: Record<string, unknown>;
  ipAddress: string;
  userAgent: string | null;
}

export async function recordConversion(input: RecordConversionInput): Promise<string> {
  const {
    campaignId,
    sessionId,
    audienceRecordId,
    triggerType,
    triggerPageId,
    triggerElementId,
    goalKey,
    goalLabel,
    payload,
    ipAddress,
    userAgent,
  } = input;

  const conversionId = await db.transaction(async (tx) => {
    const [conversion] = await tx
      .insert(campaignConversions)
      .values({
        campaignId,
        sessionId,
        audienceRecordId,
        triggerType,
        triggerPageId: triggerPageId ?? undefined,
        triggerElementId,
        goalKey: goalKey ?? null,
        goalLabel: goalLabel ?? null,
        payload,
        ipAddress,
        userAgent,
      })
      .returning({ id: campaignConversions.id });

    // Mark first conversion on session
    await tx
      .update(campaignSessions)
      .set({
        convertedAt: new Date(),
        conversionType: triggerType,
        updatedAt: new Date(),
      })
      .where(eq(campaignSessions.id, sessionId));

    // Queue webhook delivery if configured
    const webhook = await tx.query.campaignWebhooks.findFirst({
      where: eq(campaignWebhooks.campaignId, campaignId),
      columns: { id: true, enabled: true },
    });

    if (webhook?.enabled) {
      await tx.insert(webhookDeliveries).values({
        webhookId: webhook.id,
        conversionId: conversion.id,
        status: "pending",
      });
    }

    return conversion.id;
  });

  return conversionId;
}

// ─── Webhook signing ──────────────────────────────────────────────────────────

/** Build and sign a webhook payload for delivery */
export function buildWebhookPayload(
  conversion: {
    id: string;
    campaignId: string;
    triggerType: string;
    payload: Record<string, unknown>;
    convertedAt: Date;
    goalKey?: string | null;
    goalLabel?: string | null;
    /** Linked audience-record fields, enriched by flow actions/activation. */
    recordFields?: Record<string, unknown> | null;
  },
  orgSlug: string,
  payloadFields: string[],
  rawSecret: string
): { body: string; signature: string } {
  const all = mergeExportable(conversion.payload, conversion.recordFields ?? null);

  const filteredData =
    payloadFields[0] === "*"
      ? all.fields
      : Object.fromEntries(
          Object.entries(all.fields).filter(([k]) => payloadFields.includes(k))
        );

  const body = JSON.stringify({
    event: "conversion.recorded",
    campaignId: conversion.campaignId,
    orgSlug,
    triggerType: conversion.triggerType,
    goal: conversion.goalKey ?? null,
    goalLabel: conversion.goalLabel ?? null,
    tags: all.tags,
    convertedAt: conversion.convertedAt.toISOString(),
    // `formData` retained for backward compatibility; `data` is the enriched view.
    formData: filteredData,
    data: filteredData,
  });

  const signature = createHmac("sha256", rawSecret).update(body).digest("hex");

  return { body, signature };
}

/**
 * Merge form payload with the enriched audience-record fields for export.
 * Record fields (including flow-set values) take precedence over raw form data.
 * The internal `_tags` array is lifted out into a top-level `tags` list and
 * other underscore-prefixed internal keys are dropped.
 */
export function mergeExportable(
  formData: Record<string, unknown>,
  recordFields: Record<string, unknown> | null
): { fields: Record<string, unknown>; tags: string[] } {
  const merged: Record<string, unknown> = { ...formData, ...(recordFields ?? {}) };
  const rawTags = merged["_tags"];
  const tags = Array.isArray(rawTags)
    ? rawTags.filter((t): t is string => typeof t === "string")
    : [];
  const fields = Object.fromEntries(
    Object.entries(merged).filter(([k]) => !k.startsWith("_"))
  );
  return { fields, tags };
}

/** Exponential backoff delay in minutes per attempt number (1-indexed) */
export function retryDelayMinutes(attempt: number): number | null {
  const delays = [1, 5, 30, 120]; // attempts 1-4; attempt 5 → give up
  return delays[attempt - 1] ?? null;
}
