import { db } from "@/lib/db";
import {
  campaignPages,
  campaignFlowNodes,
  campaignFlowEdges,
  campaignAudienceRecords,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  evaluateBranchNode,
  pickWeightedEdge,
  hashToUnit,
  type SessionContext,
  type RuleGroup,
} from "./branch";
import { applyActions, parseActions } from "./actions";
import { updateSessionNode, patchAudienceRecordFields } from "./session";

interface SessionLike {
  id: string | null; // null = no persistent session (simulator); writes are skipped
  campaignId: string;
  currentNodeId: string | null;
  audienceRecordId: string | null;
  urlParams: Record<string, string> | null;
  // Optional pre-loaded record fields + visitor context (avoids a refetch).
  recordFields?: Record<string, unknown> | null;
  context?: Record<string, unknown>;
  // Epoch ms of session start, for the `time` source's `elapsed` field.
  sessionStart?: number;
  // Sticky-bucketing seed for A/B splits (the visitor token).
  seed?: string;
}

export interface ResolveResult {
  path: string;
  title: string | null;
  /** Non-null when the resolved page is terminal (its forward path reaches an End node). */
  goal: { key: string | null; label: string | null } | null;
}

type FlowNodeRow = typeof campaignFlowNodes.$inferSelect;

const MAX_STEPS = 50; // guard against cyclic / misconfigured graphs

function isSplit(node: FlowNodeRow): boolean {
  return node.type === "branch" && (node.config as { mode?: string } | null)?.mode === "split";
}

/**
 * Pick the next target leaving a node: weighted A/B split when the node is a
 * split branch (sticky per visitor), otherwise condition-based selection.
 */
function pickFromNode(
  node: FlowNodeRow,
  edges: EdgeRow[],
  ctx: SessionContext,
  seed: string | undefined
): string | null {
  if (isSplit(node)) {
    const unit = hashToUnit((seed ?? "") + node.id);
    return pickWeightedEdge(edges, unit);
  }
  return pickNextTarget(edges, ctx);
}

/** Pick the next target node id from a set of outgoing edges. */
function pickNextTarget(
  edges: { id: string; targetNodeId: string; ruleGroup: unknown; ruleOrder: number }[],
  ctx: SessionContext
): string | null {
  if (edges.length === 0) return null;
  const hasConditional = edges.some((e) => e.ruleGroup !== null);
  if (!hasConditional) {
    // Unconditional: lowest ruleOrder wins (stable, matches editor ordering).
    return [...edges].sort((a, b) => a.ruleOrder - b.ruleOrder)[0].targetNodeId;
  }
  return evaluateBranchNode(
    edges.map((e) => ({
      id: e.id,
      targetNodeId: e.targetNodeId,
      ruleGroup: e.ruleGroup as RuleGroup | null,
      ruleOrder: e.ruleOrder,
    })),
    ctx
  );
}

/**
 * Resolve the next page a visitor should see after leaving their current node.
 *
 * Walks the flow graph from the current node, transparently passing through
 * branch nodes (evaluate → follow) and action nodes (run actions → follow)
 * until it lands on a page node. Once landed, it looks ahead: if the page's
 * forward path terminates at an End node (optionally via action nodes), the
 * terminal actions are executed and the reached goal is returned so the caller
 * can record the conversion.
 *
 * Pass `session.id = null` for a non-persisting dry run (the simulator).
 */
export async function resolveNextPage(
  session: SessionLike,
  formData: Record<string, unknown>
): Promise<ResolveResult> {
  const nodes = await loadNodes(session.campaignId);
  const edgesBySource = await loadEdges(session.campaignId);

  // Build the read context, loading the linked audience record if needed.
  const recordFields = await loadRecordFields(session);
  const ctx: SessionContext = {
    form: formData,
    url: session.urlParams ?? {},
    record: recordFields,
    context: session.context,
    now: Date.now(),
    sessionStart: session.sessionStart,
  };

  // Determine the cursor: the node the visitor is leaving.
  let cursorId = session.currentNodeId;
  if (!cursorId) {
    // First hop: enter at the Start node's target (the entry page).
    const startNode = [...nodes.values()].find((n) => n.type === "start");
    const startEdges = startNode ? edgesBySource.get(startNode.id) ?? [] : [];
    cursorId = pickNextTarget(startEdges, ctx);
    if (!cursorId) return { path: "/", title: null, goal: null };
  }

  // Walk forward until we land on a page node (or hit a terminal End).
  let steps = 0;
  let nextId = pickNextTarget(edgesBySource.get(cursorId) ?? [], ctx);

  while (nextId && steps++ < MAX_STEPS) {
    const node = nodes.get(nextId);
    if (!node) break;

    if (node.type === "page") {
      if (session.id) await updateSessionNode(session.id, node.id);
      const page = await loadPage(node.pageId);
      const goal = await resolveTerminalGoal(node.id, nodes, edgesBySource, ctx, session, recordFields);
      return { path: page?.path ?? "/", title: page?.title ?? null, goal };
    }

    if (node.type === "end") {
      // Reached an End with no intervening page (e.g. current page → End).
      const goal = { key: node.goalKey ?? null, label: node.goalLabel ?? null };
      return { path: "/", title: null, goal };
    }

    if (node.type === "action") {
      await runActions(node, ctx, session, recordFields);
      nextId = pickNextTarget(edgesBySource.get(node.id) ?? [], ctx);
      continue;
    }

    // branch (or start appearing as a target): evaluate / split and continue
    nextId = pickFromNode(node, edgesBySource.get(node.id) ?? [], ctx, session.seed);
  }

  return { path: "/", title: null, goal: null };
}

/**
 * Look ahead from a just-landed page node: if its forward path terminates at an
 * End node (optionally through action nodes that we execute), return the goal.
 * Returns null when the path leads to another page (i.e. the page is not terminal).
 */
async function resolveTerminalGoal(
  pageNodeId: string,
  nodes: Map<string, FlowNodeRow>,
  edgesBySource: Map<string, EdgeRow[]>,
  ctx: SessionContext,
  session: SessionLike,
  recordFields: Record<string, unknown> | null
): Promise<{ key: string | null; label: string | null } | null> {
  let cursor: string | null = pickNextTarget(edgesBySource.get(pageNodeId) ?? [], ctx);
  let steps = 0;

  while (cursor && steps++ < MAX_STEPS) {
    const node = nodes.get(cursor);
    if (!node) return null;

    if (node.type === "page") return null; // more pages ahead — not terminal
    if (node.type === "end") {
      return { key: node.goalKey ?? null, label: node.goalLabel ?? null };
    }
    if (node.type === "action") {
      await runActions(node, ctx, session, recordFields);
    }
    cursor = pickFromNode(node, edgesBySource.get(node.id) ?? [], ctx, session.seed);
  }

  return null;
}

/** Execute an action node's ops, mutating ctx.record and persisting the patch. */
async function runActions(
  node: FlowNodeRow,
  ctx: SessionContext,
  session: SessionLike,
  recordFields: Record<string, unknown> | null
): Promise<void> {
  const actions = parseActions(node.actions);
  if (actions.length === 0) return;

  const { patch } = applyActions(actions, ctx);
  if (Object.keys(patch).length === 0) return;

  // Reflect the patch in the live context so later nodes read the new values.
  ctx.record = { ...(recordFields ?? {}), ...patch };

  // Persist to the linked audience record (safe no-op when none / dry run).
  if (session.id && session.audienceRecordId) {
    await patchAudienceRecordFields(session.audienceRecordId, patch);
  }
}

// ─── Loaders ───────────────────────────────────────────────────────────────

type EdgeRow = typeof campaignFlowEdges.$inferSelect;

async function loadNodes(campaignId: string): Promise<Map<string, FlowNodeRow>> {
  const rows = await db.query.campaignFlowNodes.findMany({
    where: eq(campaignFlowNodes.campaignId, campaignId),
  });
  return new Map(rows.map((r) => [r.id, r]));
}

async function loadEdges(campaignId: string): Promise<Map<string, EdgeRow[]>> {
  const rows = await db.query.campaignFlowEdges.findMany({
    where: eq(campaignFlowEdges.campaignId, campaignId),
  });
  const bySource = new Map<string, EdgeRow[]>();
  for (const e of rows) {
    const list = bySource.get(e.sourceNodeId);
    if (list) list.push(e);
    else bySource.set(e.sourceNodeId, [e]);
  }
  return bySource;
}

async function loadRecordFields(
  session: SessionLike
): Promise<Record<string, unknown> | null> {
  if (session.recordFields !== undefined) return session.recordFields;
  if (!session.audienceRecordId) return null;
  const record = await db.query.campaignAudienceRecords.findFirst({
    where: eq(campaignAudienceRecords.id, session.audienceRecordId),
    columns: { fields: true },
  });
  return (record?.fields as Record<string, unknown> | undefined) ?? null;
}

async function loadPage(pageId: string | null) {
  if (!pageId) return null;
  return db.query.campaignPages.findFirst({
    where: eq(campaignPages.id, pageId),
    columns: { path: true, title: true },
  });
}
