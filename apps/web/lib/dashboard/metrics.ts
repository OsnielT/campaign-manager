// Shared dashboard aggregation. Used by both the SSR dashboard page and the
// /api/dashboard route (range re-fetch), so the two never drift apart.

import { db } from "@/lib/db";
import {
  campaigns,
  campaignAudienceRecords,
  campaignConversions,
  campaignSessions,
  emailBroadcasts,
  webhookDeliveries,
} from "@/lib/db/schema";
import { eq, and, inArray, count, desc, gte, lt, sql } from "drizzle-orm";

export type DashboardRange = "7d" | "30d" | "90d" | "all";

export const RANGE_DAYS: Record<DashboardRange, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

export function isRange(v: string | null | undefined): v is DashboardRange {
  return v === "7d" || v === "30d" || v === "90d" || v === "all";
}

export interface Kpi {
  value: number;
  /** % change vs the immediately preceding period; null when no prior baseline. */
  deltaPct: number | null;
  /** Daily series for the sparkline (range-scoped, gap-filled). */
  series: number[];
}

export interface AttentionItem {
  kind: "broadcast_failed" | "broadcast_scheduled" | "campaign_expiring" | "campaign_going_live" | "webhook_failed";
  label: string;
  detail: string;
  href: string;
}

export interface LeaderRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  records: number;
  activations: number;
  conversions: number;
  sessions: number;
  // Converted sessions / sessions (0..1), or null when there are no sessions yet.
  convRate: number | null;
}

export interface RecentBroadcast {
  id: string;
  name: string;
  campaignSlug: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
  scheduledAt: string | null;
}

export interface DashboardMetrics {
  range: DashboardRange;
  statusCounts: Record<string, number>;
  totalCampaigns: number;
  kpis: {
    conversions: Kpi;
    audienceAdded: Kpi;
    activationRate: Kpi;
    emailsSent: Kpi;
  };
  funnel: { records: number; activations: number; conversions: number };
  timeseries: { date: string; conversions: number }[];
  attention: AttentionItem[];
  leaderboard: LeaderRow[];
  recentCampaigns: LeaderRow[];
  recentBroadcasts: RecentBroadcast[];
}

const ACTIVATED = sql`${campaignAudienceRecords.fields}->>'_activated_at' != '' and ${campaignAudienceRecords.fields}->>'_activated_at' is not null`;

/** Build the org's non-template campaign id list once; everything scopes to it. */
async function orgCampaignIds(orgId: string): Promise<string[]> {
  const rows = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTemplate, false)));
  return rows.map((r) => r.id);
}

function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

/** Fill a day-bucketed count map into a continuous gap-filled series. */
function fillSeries(map: Record<string, number>, since: Date, days: number): { date: string; conversions: number }[] {
  const out: { date: string; conversions: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, conversions: map[key] ?? 0 });
  }
  return out;
}

export async function getDashboardMetrics(orgId: string, range: DashboardRange): Promise<DashboardMetrics> {
  const ids = await orgCampaignIds(orgId);
  const days = RANGE_DAYS[range];
  // For "all" we still want a sensible chart window.
  const chartDays = days ?? 90;
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - chartDays);
  const prevSince = new Date(since);
  prevSince.setDate(prevSince.getDate() - chartDays);

  // ── Status breakdown (all-time) ──
  const statusRows = ids.length
    ? await db
        .select({ status: campaigns.status, cnt: count() })
        .from(campaigns)
        .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTemplate, false)))
        .groupBy(campaigns.status)
    : [];
  const statusCounts: Record<string, number> = {};
  for (const r of statusRows) statusCounts[r.status] = Number(r.cnt);
  const totalCampaigns = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  if (ids.length === 0) {
    const emptyKpi: Kpi = { value: 0, deltaPct: null, series: [] };
    return {
      range,
      statusCounts,
      totalCampaigns,
      kpis: { conversions: emptyKpi, audienceAdded: emptyKpi, activationRate: emptyKpi, emailsSent: emptyKpi },
      funnel: { records: 0, activations: 0, conversions: 0 },
      timeseries: fillSeries({}, since, chartDays),
      attention: [],
      leaderboard: [],
      recentCampaigns: [],
      recentBroadcasts: [],
    };
  }

  // ── Period counters (current vs prior) ──
  const inIds = inArray(campaignConversions.campaignId, ids);
  const recIn = inArray(campaignAudienceRecords.campaignId, ids);

  const countConversions = (from: Date, to?: Date) =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(campaignConversions)
      .where(and(inIds, gte(campaignConversions.convertedAt, from), ...(to ? [lt(campaignConversions.convertedAt, to)] : [])))
      .then((r) => r[0]?.c ?? 0);

  const countRecords = (from: Date, to?: Date) =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(campaignAudienceRecords)
      .where(and(recIn, gte(campaignAudienceRecords.createdAt, from), ...(to ? [lt(campaignAudienceRecords.createdAt, to)] : [])))
      .then((r) => r[0]?.c ?? 0);

  const countActivations = (from: Date, to?: Date) =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(campaignAudienceRecords)
      .where(
        and(
          recIn,
          ACTIVATED,
          sql`(${campaignAudienceRecords.fields}->>'_activated_at') >= ${from.toISOString()}`,
          ...(to ? [sql`(${campaignAudienceRecords.fields}->>'_activated_at') < ${to.toISOString()}`] : []),
        ),
      )
      .then((r) => r[0]?.c ?? 0);

  const sumEmails = (from: Date, to?: Date) =>
    db
      .select({ c: sql<number>`coalesce(sum(${emailBroadcasts.sentCount}),0)::int` })
      .from(emailBroadcasts)
      .where(and(inArray(emailBroadcasts.campaignId, ids), sql`${emailBroadcasts.sentAt} is not null`, gte(emailBroadcasts.sentAt, from), ...(to ? [lt(emailBroadcasts.sentAt, to)] : [])))
      .then((r) => r[0]?.c ?? 0);

  // ── Lifetime totals (for funnel) ──
  const lifetime = async () => {
    const [recs, acts, convs] = await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(campaignAudienceRecords).where(recIn).then((r) => r[0]?.c ?? 0),
      db.select({ c: sql<number>`count(*)::int` }).from(campaignAudienceRecords).where(and(recIn, ACTIVATED)).then((r) => r[0]?.c ?? 0),
      db.select({ c: sql<number>`count(*)::int` }).from(campaignConversions).where(inIds).then((r) => r[0]?.c ?? 0),
    ]);
    return { records: recs, activations: acts, conversions: convs };
  };

  // ── Daily conversions series (current period) ──
  const seriesRows = await db
    .select({ day: sql<string>`date_trunc('day', ${campaignConversions.convertedAt})::date::text`, cnt: count() })
    .from(campaignConversions)
    .where(and(inIds, gte(campaignConversions.convertedAt, since)))
    .groupBy(sql`date_trunc('day', ${campaignConversions.convertedAt})`)
    .orderBy(sql`date_trunc('day', ${campaignConversions.convertedAt})`);
  const seriesMap: Record<string, number> = {};
  for (const r of seriesRows) seriesMap[r.day] = Number(r.cnt);
  const timeseries = fillSeries(seriesMap, since, chartDays);

  const [
    convCur, convPrev,
    recCur, recPrev,
    actCur, actPrev,
    emailCur, emailPrev,
    funnel,
  ] = await Promise.all([
    countConversions(since), days ? countConversions(prevSince, since) : Promise.resolve(0),
    countRecords(since), days ? countRecords(prevSince, since) : Promise.resolve(0),
    countActivations(since), days ? countActivations(prevSince, since) : Promise.resolve(0),
    sumEmails(since), days ? sumEmails(prevSince, since) : Promise.resolve(0),
    lifetime(),
  ]);

  const actRateCur = recCur > 0 ? Math.round((actCur / recCur) * 100) : 0;
  const actRatePrev = recPrev > 0 ? Math.round((actPrev / recPrev) * 100) : 0;

  // ── Attention items ──
  const attention = await buildAttention(orgId, ids);

  // ── Leaderboard (by conversions in range) + recent campaigns fallback ──
  const [leaderboard, recentCampaigns] = await Promise.all([
    buildLeaderboard(ids, since),
    buildRecentCampaigns(orgId, ids),
  ]);

  // ── Recent broadcasts ──
  const broadcastRows = await db
    .select({
      id: emailBroadcasts.id,
      name: emailBroadcasts.name,
      slug: campaigns.slug,
      status: emailBroadcasts.status,
      recipientCount: emailBroadcasts.recipientCount,
      sentCount: emailBroadcasts.sentCount,
      failedCount: emailBroadcasts.failedCount,
      sentAt: emailBroadcasts.sentAt,
      scheduledAt: emailBroadcasts.scheduledAt,
    })
    .from(emailBroadcasts)
    .innerJoin(campaigns, eq(emailBroadcasts.campaignId, campaigns.id))
    .where(inArray(emailBroadcasts.campaignId, ids))
    .orderBy(desc(emailBroadcasts.updatedAt))
    .limit(5);
  const recentBroadcasts: RecentBroadcast[] = broadcastRows.map((b) => ({
    id: b.id,
    name: b.name,
    campaignSlug: b.slug,
    status: b.status,
    recipientCount: b.recipientCount,
    sentCount: b.sentCount,
    failedCount: b.failedCount,
    sentAt: b.sentAt ? b.sentAt.toISOString() : null,
    scheduledAt: b.scheduledAt ? b.scheduledAt.toISOString() : null,
  }));

  // Sparkline series: reuse the conversions series for conversions KPI; others get
  // a flat placeholder of their period total spread to a single point (kept simple —
  // the conversions chart is the primary trend surface).
  const convSeries = timeseries.map((d) => d.conversions);

  return {
    range,
    statusCounts,
    totalCampaigns,
    kpis: {
      conversions: { value: convCur, deltaPct: days ? pctDelta(convCur, convPrev) : null, series: convSeries },
      audienceAdded: { value: recCur, deltaPct: days ? pctDelta(recCur, recPrev) : null, series: [] },
      activationRate: { value: actRateCur, deltaPct: days ? pctDelta(actRateCur, actRatePrev) : null, series: [] },
      emailsSent: { value: emailCur, deltaPct: days ? pctDelta(emailCur, emailPrev) : null, series: [] },
    },
    funnel,
    timeseries,
    attention,
    leaderboard,
    recentCampaigns,
    recentBroadcasts,
  };
}

/** Last 5 campaigns by recency, with lifetime record/activation/conversion counts. */
async function buildRecentCampaigns(orgId: string, ids: string[]): Promise<LeaderRow[]> {
  const meta = await db
    .select({ id: campaigns.id, name: campaigns.name, slug: campaigns.slug, status: campaigns.status })
    .from(campaigns)
    .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTemplate, false)))
    .orderBy(desc(campaigns.updatedAt))
    .limit(5);
  const topIds = meta.map((m) => m.id);
  if (topIds.length === 0) return [];

  const [records, activations, conversions, sessions] = await Promise.all([
    db.select({ campaignId: campaignAudienceRecords.campaignId, cnt: sql<number>`count(*)::int` }).from(campaignAudienceRecords).where(inArray(campaignAudienceRecords.campaignId, topIds)).groupBy(campaignAudienceRecords.campaignId),
    db.select({ campaignId: campaignAudienceRecords.campaignId, cnt: sql<number>`count(*)::int` }).from(campaignAudienceRecords).where(and(inArray(campaignAudienceRecords.campaignId, topIds), ACTIVATED)).groupBy(campaignAudienceRecords.campaignId),
    db.select({ campaignId: campaignConversions.campaignId, cnt: sql<number>`count(*)::int` }).from(campaignConversions).where(inArray(campaignConversions.campaignId, topIds)).groupBy(campaignConversions.campaignId),
    db.select({ campaignId: campaignSessions.campaignId, total: sql<number>`count(*)::int`, converted: sql<number>`count(*) filter (where ${campaignSessions.convertedAt} is not null)::int` }).from(campaignSessions).where(inArray(campaignSessions.campaignId, topIds)).groupBy(campaignSessions.campaignId),
  ]);
  const recMap = Object.fromEntries(records.map((r) => [r.campaignId, r.cnt]));
  const actMap = Object.fromEntries(activations.map((r) => [r.campaignId, r.cnt]));
  const convMap = Object.fromEntries(conversions.map((r) => [r.campaignId, r.cnt]));
  const sessMap = Object.fromEntries(sessions.map((r) => [r.campaignId, r]));

  return meta.map((m) => {
    const s = sessMap[m.id];
    const sess = s?.total ?? 0;
    return { id: m.id, name: m.name, slug: m.slug, status: m.status, records: recMap[m.id] ?? 0, activations: actMap[m.id] ?? 0, conversions: convMap[m.id] ?? 0, sessions: sess, convRate: sess > 0 ? (s!.converted) / sess : null };
  });
}

async function buildAttention(orgId: string, ids: string[]): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);

  // Broadcasts: failed sends, or scheduled in the future.
  const bcasts = await db
    .select({
      id: emailBroadcasts.id,
      name: emailBroadcasts.name,
      slug: campaigns.slug,
      status: emailBroadcasts.status,
      failedCount: emailBroadcasts.failedCount,
      scheduledAt: emailBroadcasts.scheduledAt,
    })
    .from(emailBroadcasts)
    .innerJoin(campaigns, eq(emailBroadcasts.campaignId, campaigns.id))
    .where(inArray(emailBroadcasts.campaignId, ids));
  for (const b of bcasts) {
    const href = `/campaigns/${b.slug}/email/${b.id}`;
    if (b.status === "failed" || b.failedCount > 0) {
      items.push({ kind: "broadcast_failed", label: b.name, detail: `${b.failedCount} failed`, href });
    } else if (b.status === "scheduled" && b.scheduledAt && b.scheduledAt > new Date()) {
      items.push({ kind: "broadcast_scheduled", label: b.name, detail: `Sends ${b.scheduledAt.toLocaleString()}`, href });
    }
  }

  // Campaigns: published expiring within 7d, or scheduled going live within 7d.
  const camps = await db
    .select({ name: campaigns.name, slug: campaigns.slug, status: campaigns.status, scheduledAt: campaigns.scheduledAt, expiresAt: campaigns.expiresAt })
    .from(campaigns)
    .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTemplate, false)));
  for (const c of camps) {
    if (c.status === "published" && c.expiresAt && c.expiresAt > new Date() && c.expiresAt <= soon) {
      items.push({ kind: "campaign_expiring", label: c.name, detail: `Expires ${c.expiresAt.toLocaleDateString()}`, href: `/campaigns/${c.slug}` });
    } else if (c.status === "scheduled" && c.scheduledAt && c.scheduledAt > new Date() && c.scheduledAt <= soon) {
      items.push({ kind: "campaign_going_live", label: c.name, detail: `Goes live ${c.scheduledAt.toLocaleDateString()}`, href: `/campaigns/${c.slug}` });
    }
  }

  // Webhook delivery failures (joined back to a campaign via conversion).
  const failedDeliveries = await db
    .select({ slug: campaigns.slug, cnt: count() })
    .from(webhookDeliveries)
    .innerJoin(campaignConversions, eq(webhookDeliveries.conversionId, campaignConversions.id))
    .innerJoin(campaigns, eq(campaignConversions.campaignId, campaigns.id))
    .where(and(inArray(campaignConversions.campaignId, ids), eq(webhookDeliveries.status, "failed")))
    .groupBy(campaigns.slug);
  for (const d of failedDeliveries) {
    if (Number(d.cnt) > 0) {
      items.push({ kind: "webhook_failed", label: "Webhook delivery failing", detail: `${d.cnt} failed on /${d.slug}`, href: `/campaigns/${d.slug}/conversions` });
    }
  }

  return items.slice(0, 8);
}

async function buildLeaderboard(ids: string[], since: Date): Promise<LeaderRow[]> {
  // Top campaigns by conversions in the period.
  const convRows = await db
    .select({ campaignId: campaignConversions.campaignId, cnt: sql<number>`count(*)::int` })
    .from(campaignConversions)
    .where(and(inArray(campaignConversions.campaignId, ids), gte(campaignConversions.convertedAt, since)))
    .groupBy(campaignConversions.campaignId)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  const topIds = convRows.map((r) => r.campaignId);
  if (topIds.length === 0) return [];

  const [meta, records, activations, sessions] = await Promise.all([
    db.select({ id: campaigns.id, name: campaigns.name, slug: campaigns.slug, status: campaigns.status }).from(campaigns).where(inArray(campaigns.id, topIds)),
    db.select({ campaignId: campaignAudienceRecords.campaignId, cnt: sql<number>`count(*)::int` }).from(campaignAudienceRecords).where(inArray(campaignAudienceRecords.campaignId, topIds)).groupBy(campaignAudienceRecords.campaignId),
    db.select({ campaignId: campaignAudienceRecords.campaignId, cnt: sql<number>`count(*)::int` }).from(campaignAudienceRecords).where(and(inArray(campaignAudienceRecords.campaignId, topIds), ACTIVATED)).groupBy(campaignAudienceRecords.campaignId),
    db.select({ campaignId: campaignSessions.campaignId, total: sql<number>`count(*)::int`, converted: sql<number>`count(*) filter (where ${campaignSessions.convertedAt} is not null)::int` }).from(campaignSessions).where(inArray(campaignSessions.campaignId, topIds)).groupBy(campaignSessions.campaignId),
  ]);

  const metaMap = Object.fromEntries(meta.map((m) => [m.id, m]));
  const recMap = Object.fromEntries(records.map((r) => [r.campaignId, r.cnt]));
  const actMap = Object.fromEntries(activations.map((r) => [r.campaignId, r.cnt]));
  const sessMap = Object.fromEntries(sessions.map((r) => [r.campaignId, r]));

  return convRows.map((r) => {
    const m = metaMap[r.campaignId];
    const s = sessMap[r.campaignId];
    const sess = s?.total ?? 0;
    return {
      id: r.campaignId,
      name: m?.name ?? "—",
      slug: m?.slug ?? "",
      status: m?.status ?? "draft",
      records: recMap[r.campaignId] ?? 0,
      activations: actMap[r.campaignId] ?? 0,
      conversions: r.cnt,
      sessions: sess,
      convRate: sess > 0 ? (s!.converted) / sess : null,
    };
  });
}
