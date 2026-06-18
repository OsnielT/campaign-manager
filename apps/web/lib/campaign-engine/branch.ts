/**
 * Pure branch node evaluator — no DB calls, fully unit-testable.
 *
 * Given an ordered list of edges and a session context, returns the target
 * node ID of the first matching edge, or the fallback (null rule_group) edge.
 *
 * Sources: form / url / record (audience fields) / context (device·geo·source)
 * / time (clock & elapsed). Condition values may be literals or references to
 * another field (`{ ref: { source, key } }`), and rule groups may nest for
 * arbitrary AND/OR trees.
 */

export interface SessionContext {
  form: Record<string, unknown>;
  url: Record<string, string>;
  record: Record<string, unknown> | null;
  // Visitor context (device/geo/source). Frozen at session creation.
  context?: Record<string, unknown>;
  // Clock inputs for the `time` source (ms epoch). Default to "now"/unset.
  now?: number;
  sessionStart?: number;
}

export type ConditionSource = "form" | "url" | "record" | "context" | "time";

export type Operator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty";

/** A reference to another field's value, used in place of a literal. */
export interface FieldRef {
  ref: { source: ConditionSource; field: string };
}

export type ConditionValue = string | number | [number, number] | FieldRef;

export interface Condition {
  source: ConditionSource;
  field: string;
  operator: Operator;
  value: ConditionValue;
}

/** A rule group may contain conditions and/or nested groups. */
export type RuleNode = Condition | RuleGroup;

export interface RuleGroup {
  logic: "and" | "or";
  conditions: RuleNode[];
}

export interface FlowEdge {
  id: string;
  targetNodeId: string;
  ruleGroup: RuleGroup | null;
  ruleOrder: number;
  // Relative weight for A/B split selection (default 1).
  weight?: number | null;
}

function isRuleGroup(node: RuleNode): node is RuleGroup {
  return typeof (node as RuleGroup).logic === "string" && Array.isArray((node as RuleGroup).conditions);
}

function isFieldRef(value: ConditionValue): value is FieldRef {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && "ref" in value;
}

function getFieldValue(
  context: SessionContext,
  source: ConditionSource,
  field: string
): unknown {
  if (source === "form") return context.form[field];
  if (source === "url") return context.url[field];
  if (source === "record") return context.record?.[field] ?? null;
  if (source === "context") return context.context?.[field] ?? null;
  if (source === "time") {
    const now = context.now ?? Date.now();
    const d = new Date(now);
    if (field === "hour") return d.getUTCHours();
    if (field === "dow") return d.getUTCDay(); // 0 = Sunday
    if (field === "date") return d.toISOString().slice(0, 10); // YYYY-MM-DD (lexically comparable)
    if (field === "elapsed") {
      if (context.sessionStart == null) return null;
      return Math.floor((now - context.sessionStart) / 1000); // seconds since start
    }
    return null;
  }
  return null;
}

/** Compare two scalars for ordered operators, numeric when both look numeric. */
function compare(a: unknown, b: unknown): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb ? 0 : na < nb ? -1 : 1;
  const sa = String(a);
  const sb = String(b);
  return sa === sb ? 0 : sa < sb ? -1 : 1;
}

function evaluateCondition(condition: Condition, context: SessionContext): boolean {
  const raw = getFieldValue(context, condition.source, condition.field);
  const { operator } = condition;

  // Nullish / emptiness
  if (operator === "is_empty") {
    return raw === null || raw === undefined || raw === "";
  }
  if (operator === "is_not_empty") {
    return raw !== null && raw !== undefined && raw !== "";
  }

  // For comparisons, a missing source value never matches.
  if (raw === null || raw === undefined) return false;

  // Resolve the comparison value (literal, or a reference to another field).
  let value: unknown = condition.value;
  if (isFieldRef(condition.value)) {
    value = getFieldValue(context, condition.value.ref.source, condition.value.ref.field);
    if (value === null || value === undefined) return false;
  }

  switch (operator) {
    case "eq":
      return String(raw) === String(value);
    case "neq":
      return String(raw) !== String(value);
    case "gt":
      return compare(raw, value) > 0;
    case "gte":
      return compare(raw, value) >= 0;
    case "lt":
      return compare(raw, value) < 0;
    case "lte":
      return compare(raw, value) <= 0;
    case "between": {
      if (!Array.isArray(value) || value.length !== 2) return false;
      const [min, max] = value;
      return compare(raw, min) >= 0 && compare(raw, max) <= 0;
    }
    case "contains":
      return String(raw).toLowerCase().includes(String(value).toLowerCase());
    case "starts_with":
      return String(raw).toLowerCase().startsWith(String(value).toLowerCase());
    case "ends_with":
      return String(raw).toLowerCase().endsWith(String(value).toLowerCase());
    default:
      return false;
  }
}

export function evaluateRuleGroup(group: RuleGroup, context: SessionContext): boolean {
  if (group.conditions.length === 0) return true;
  const evalNode = (n: RuleNode) =>
    isRuleGroup(n) ? evaluateRuleGroup(n, context) : evaluateCondition(n, context);
  if (group.logic === "and") return group.conditions.every(evalNode);
  return group.conditions.some(evalNode);
}

/**
 * Evaluate outgoing edges of a branch node in rule_order (ascending).
 * Returns the targetNodeId of the first matching edge.
 * The fallback edge (ruleGroup = null) should have the highest ruleOrder.
 */
export function evaluateBranchNode(
  edges: FlowEdge[],
  context: SessionContext
): string | null {
  const sorted = [...edges].sort((a, b) => a.ruleOrder - b.ruleOrder);

  let fallbackTarget: string | null = null;

  for (const edge of sorted) {
    if (edge.ruleGroup === null) {
      fallbackTarget = edge.targetNodeId;
      continue; // Skip fallback on first pass
    }
    if (evaluateRuleGroup(edge.ruleGroup, context)) {
      return edge.targetNodeId;
    }
  }

  return fallbackTarget;
}

// ─── A/B split ───────────────────────────────────────────────────────────────

/** Deterministic hash of a seed string into the unit interval [0, 1). */
export function hashToUnit(seed: string): number {
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Pick an outgoing edge by relative weight using a precomputed unit value in
 * [0, 1). Sticky per visitor when the unit derives from their visitor token.
 */
export function pickWeightedEdge(
  edges: { targetNodeId: string; weight?: number | null; ruleOrder: number }[],
  unit: number
): string | null {
  if (edges.length === 0) return null;
  const ordered = [...edges].sort((a, b) => a.ruleOrder - b.ruleOrder);
  const weights = ordered.map((e) => Math.max(0, e.weight ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return ordered[0].targetNodeId;
  const x = unit * total;
  let acc = 0;
  for (let i = 0; i < ordered.length; i++) {
    acc += weights[i];
    if (x < acc) return ordered[i].targetNodeId;
  }
  return ordered[ordered.length - 1].targetNodeId;
}
