/**
 * Pure flow simulation + static validation — no DB, fully unit-testable.
 *
 * `simulateFlow` walks the graph from the Start node using fixed sample inputs
 * and reports the visited path, fired actions, resulting field values, and the
 * goal reached. `validateFlow` returns structural issues that should block (or
 * warn before) publish.
 */
import {
  evaluateBranchNode,
  pickWeightedEdge,
  hashToUnit,
  type RuleGroup,
  type SessionContext,
} from "./branch";
import { applyActions, parseActions, type FlowAction } from "./actions";

export type NodeType = "start" | "page" | "branch" | "action" | "end";

export interface SimNode {
  id: string;
  type: NodeType;
  pageId?: string | null;
  label?: string | null;
  goalKey?: string | null;
  goalLabel?: string | null;
  actions?: FlowAction[] | unknown;
  config?: { mode?: string } | null;
}

export interface SimEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  ruleGroup: RuleGroup | null;
  ruleOrder: number;
  weight?: number | null;
}

export interface SimStep {
  nodeId: string;
  type: NodeType;
  label: string | null;
  /** For action nodes: the field patch applied at this step. */
  patch?: Record<string, unknown>;
}

export interface SimResult {
  visited: SimStep[];
  goal: { key: string | null; label: string | null } | null;
  /** Accumulated record fields after all actions ran. */
  fields: Record<string, unknown>;
  /** Set when the walk stopped without reaching an End node. */
  deadEnd: boolean;
  /** Set when the step guard tripped (likely a cycle). */
  truncated: boolean;
}

const MAX_STEPS = 100;

function edgesFrom(edges: SimEdge[], sourceId: string): SimEdge[] {
  return edges.filter((e) => e.sourceNodeId === sourceId);
}

function pickNext(edges: SimEdge[], ctx: SessionContext): string | null {
  if (edges.length === 0) return null;
  const hasConditional = edges.some((e) => e.ruleGroup !== null);
  if (!hasConditional) {
    return [...edges].sort((a, b) => a.ruleOrder - b.ruleOrder)[0].targetNodeId;
  }
  return evaluateBranchNode(
    edges.map((e) => ({
      id: e.id,
      targetNodeId: e.targetNodeId,
      ruleGroup: e.ruleGroup,
      ruleOrder: e.ruleOrder,
    })),
    ctx
  );
}

export function simulateFlow(
  nodes: SimNode[],
  edges: SimEdge[],
  input: {
    form?: Record<string, unknown>;
    url?: Record<string, string>;
    record?: Record<string, unknown>;
    context?: Record<string, unknown>;
    now?: number;
    sessionStart?: number;
    seed?: string;
  }
): SimResult {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const start = nodes.find((n) => n.type === "start");
  const seed = input.seed ?? "sim";

  const fields: Record<string, unknown> = { ...(input.record ?? {}) };
  const ctx: SessionContext = {
    form: input.form ?? {},
    url: input.url ?? {},
    record: fields,
    context: input.context,
    now: input.now,
    sessionStart: input.sessionStart,
  };

  const visited: SimStep[] = [];
  if (!start) {
    return { visited, goal: null, fields, deadEnd: true, truncated: false };
  }

  let cursor: string | null = start.id;
  let steps = 0;

  while (cursor && steps++ < MAX_STEPS) {
    const node = byId.get(cursor);
    if (!node) break;

    const step: SimStep = { nodeId: node.id, type: node.type, label: node.label ?? null };

    if (node.type === "action") {
      const acts = parseActions(node.actions);
      const { patch } = applyActions(acts, ctx);
      Object.assign(fields, patch);
      ctx.record = fields;
      step.patch = patch;
    }

    visited.push(step);

    if (node.type === "end") {
      return {
        visited,
        goal: { key: node.goalKey ?? null, label: node.goalLabel ?? null },
        fields,
        deadEnd: false,
        truncated: false,
      };
    }

    const out = edgesFrom(edges, node.id);
    if (node.type === "branch" && node.config?.mode === "split") {
      cursor = pickWeightedEdge(out, hashToUnit(seed + node.id));
    } else {
      cursor = pickNext(out, ctx);
    }
  }

  return {
    visited,
    goal: null,
    fields,
    deadEnd: cursor === null,
    truncated: steps >= MAX_STEPS,
  };
}

// ─── Static validation ───────────────────────────────────────────────────────

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
}

export function validateFlow(nodes: SimNode[], edges: SimEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const starts = nodes.filter((n) => n.type === "start");
  const ends = nodes.filter((n) => n.type === "end");

  if (starts.length === 0) {
    issues.push({ level: "error", code: "no_start", message: "Flow has no Start node." });
  } else if (starts.length > 1) {
    issues.push({
      level: "error",
      code: "multiple_starts",
      message: `Flow has ${starts.length} Start nodes; expected exactly one entry per flow.`,
    });
  }
  if (ends.length === 0) {
    issues.push({ level: "error", code: "no_end", message: "Flow has no End node; visitors have nowhere to finish." });
  }

  // Reachability from the (first) start.
  const reachable = new Set<string>();
  if (starts.length > 0) {
    const stack = [starts[0].id];
    while (stack.length) {
      const id = stack.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const e of edgesFrom(edges, id)) stack.push(e.targetNodeId);
    }
  }

  for (const node of nodes) {
    const out = edgesFrom(edges, node.id);

    if (node.type !== "start" && starts.length > 0 && !reachable.has(node.id)) {
      issues.push({
        level: "warning",
        code: "unreachable",
        message: `${labelFor(node)} is unreachable from Start.`,
        nodeId: node.id,
      });
    }

    if (node.type === "end" && out.length > 0) {
      issues.push({
        level: "error",
        code: "end_has_outgoing",
        message: `${labelFor(node)} is an End node but has outgoing edges.`,
        nodeId: node.id,
      });
    }

    if (node.type === "action" && out.length !== 1) {
      issues.push({
        level: "error",
        code: "action_fanout",
        message: `${labelFor(node)} must have exactly one outgoing edge (has ${out.length}).`,
        nodeId: node.id,
      });
    }

    if (node.type === "page" && !node.pageId) {
      issues.push({
        level: "error",
        code: "page_without_page",
        message: `${labelFor(node)} is a Page node with no page attached.`,
        nodeId: node.id,
      });
    }

    // A/B split branches route by weight (all edges unconditional) — the
    // fallback rules below don't apply to them.
    if (node.type === "branch" && node.config?.mode === "split") {
      if (out.length < 2) {
        issues.push({
          level: "warning",
          code: "split_needs_arms",
          message: `${labelFor(node)} is an A/B split but has fewer than two outgoing edges.`,
          nodeId: node.id,
        });
      }
    } else if (node.type === "branch") {
      const conditional = out.filter((e) => e.ruleGroup !== null);
      const fallback = out.filter((e) => e.ruleGroup === null);
      if (conditional.length > 0 && fallback.length === 0) {
        issues.push({
          level: "warning",
          code: "branch_no_fallback",
          message: `${labelFor(node)} has conditional edges but no fallback — visitors who match nothing get stuck.`,
          nodeId: node.id,
        });
      }
      if (fallback.length > 1) {
        issues.push({
          level: "warning",
          code: "branch_multi_fallback",
          message: `${labelFor(node)} has ${fallback.length} fallback edges; only one is used.`,
          nodeId: node.id,
        });
      }
    }

    // Non-terminal dead end: a page/branch/start with no way forward.
    if (node.type !== "end" && out.length === 0 && reachable.has(node.id)) {
      issues.push({
        level: "warning",
        code: "dead_end",
        message: `${labelFor(node)} has no outgoing edge and is not an End node.`,
        nodeId: node.id,
      });
    }

    void byId; // (reserved for future cross-node checks)
  }

  return issues;
}

function labelFor(node: SimNode): string {
  const name = node.label?.trim();
  if (name) return `"${name}"`;
  return `${node.type[0].toUpperCase()}${node.type.slice(1)} node`;
}
