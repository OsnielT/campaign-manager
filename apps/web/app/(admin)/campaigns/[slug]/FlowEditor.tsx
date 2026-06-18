"use client";

import {
  useState,
  useCallback,
  useMemo,
  useContext,
  createContext,
  FormEvent,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  type NodeProps,
  type EdgeProps,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlowPage {
  id: string;
  title: string;
  path: string;
  type: string;
  isEntry: boolean;
  isConversionPage?: boolean;
}

export type FlowNodeType = "start" | "page" | "branch" | "action" | "end";

export type FlowAction =
  | { op: "set"; field: string; value: string }
  | { op: "copy"; field: string; from: { source: "form" | "url" | "record" | "context"; key: string } }
  | { op: "compute"; field: string; expr: "increment" | "sum" | "concat"; args: string[] }
  | { op: "tag"; add?: string[]; remove?: string[] };

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  pageId: string | null;
  label: string | null;
  canvasX: number;
  canvasY: number;
  page?: FlowPage | null;
  // End nodes (named goals)
  goalKey?: string | null;
  goalLabel?: string | null;
  goalValue?: number | null;
  // Action nodes
  actions?: FlowAction[] | null;
  config?: Record<string, unknown> | null;
}

export type Operator =
  | "eq" | "neq"
  | "gt" | "gte" | "lt" | "lte" | "between"
  | "contains" | "starts_with" | "ends_with"
  | "is_empty" | "is_not_empty";

export type ConditionSource = "form" | "url" | "record" | "context" | "time";

export interface Condition {
  source: ConditionSource;
  field: string;
  operator: Operator;
  value: string;
}

export interface RuleGroup {
  logic: "and" | "or";
  conditions: Condition[];
}

// Visitor-context keys (device/geo/source) and time fields, surfaced in the UI.
const CONTEXT_FIELDS = [
  "country", "region", "city", "device", "os", "browser",
  "referrer", "utm_source", "utm_medium", "utm_campaign",
];
const TIME_FIELDS: { value: string; label: string }[] = [
  { value: "hour", label: "hour (0–23 UTC)" },
  { value: "dow", label: "day of week (0=Sun)" },
  { value: "date", label: "date (YYYY-MM-DD)" },
  { value: "elapsed", label: "elapsed (seconds)" },
];

export interface FlowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  ruleGroup: RuleGroup | null;
  ruleOrder: number;
  weight?: number | null;
}

interface ValidationWarning {
  type: "orphaned" | "dead_end" | "no_fallback";
  nodeId: string;
  label: string;
}

interface NodeIssue {
  level: "error" | "warning";
  count: number;
  messages: string[];
}

// Per-node validation issues, read by the custom node components to render a badge.
const NodeIssuesContext = createContext<Map<string, NodeIssue>>(new Map());

function warningText(w: ValidationWarning): string {
  if (w.type === "orphaned") return `"${w.label}" has no incoming connections — it may be unreachable.`;
  if (w.type === "dead_end") return `"${w.label}" has no outgoing connections and isn't an End node — visitors will be stuck.`;
  return `Branch "${w.label}" has no fallback edge — visitors who don't match any rule will have nowhere to go.`;
}

/** Small notification bubble shown on a node when it has validation issues. */
function NodeBadge({ id }: { id: string }) {
  const issues = useContext(NodeIssuesContext);
  const issue = issues.get(id);
  if (!issue) return null;
  const color = issue.level === "error" ? "var(--danger)" : "var(--warning, #d4a017)";
  return (
    <div
      title={issue.messages.join("\n")}
      className="nodrag"
      style={{
        position: "absolute",
        top: -8,
        right: -8,
        minWidth: 17,
        height: 17,
        padding: "0 4px",
        borderRadius: 99,
        background: color,
        color: "#fff",
        fontSize: 10,
        fontWeight: 700,
        lineHeight: "17px",
        textAlign: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
        zIndex: 6,
        cursor: "help",
      }}
    >
      {issue.level === "error" ? "✕" : "!"}
      {issue.count > 1 ? ` ${issue.count}` : ""}
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_W = 160;
const NODE_H = 56;

const OPERATORS: { value: Operator; label: string; noValue?: boolean }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "between", label: "between (a,b)" },
  { value: "is_empty", label: "is empty", noValue: true },
  { value: "is_not_empty", label: "is not empty", noValue: true },
];

const PAGE_TYPE_COLORS: Record<string, string> = {
  landing:      "var(--accent)",
  confirmation: "var(--success)",
  offer:        "var(--warning)",
  result:       "var(--info, #6366f1)",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCsrf() {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("primitive_csrf="))
      ?.split("=")[1] ?? ""
  );
}

function genId() {
  return crypto.randomUUID();
}

function nodeName(n: FlowNode): string {
  if (n.type === "page") return n.page?.title ?? n.label ?? "Page";
  if (n.type === "start") return "● Start";
  if (n.type === "action") return `⚙ ${n.label ?? "Action"}`;
  if (n.type === "end") return `◆ ${n.goalLabel ?? n.label ?? "End"}`;
  return `⑂ ${n.label ?? "Branch"}`;
}

function ruleSummary(rg: RuleGroup | null): string {
  if (!rg || rg.conditions.length === 0) return "fallback";
  if (rg.conditions.length === 1) {
    const c = rg.conditions[0];
    return `${c.source}.${c.field} ${c.operator}${c.value ? ` "${c.value}"` : ""}`;
  }
  return `${rg.conditions.length} conditions (${rg.logic.toUpperCase()})`;
}

// ─── Dagre auto-layout ────────────────────────────────────────────────────────

function applyDagreLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
  direction: "TB" | "LR"
): FlowNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.sourceNodeId, e.targetNodeId));
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, canvasX: pos.x - NODE_W / 2, canvasY: pos.y - NODE_H / 2 };
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFlow(
  nodes: FlowNode[],
  edges: FlowEdge[]
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  nodes.forEach((n) => {
    // Start nodes are the entry — no incoming expected.
    if (n.type === "start") return;
    const hasIncoming = edges.some((e) => e.targetNodeId === n.id);
    if (!hasIncoming) {
      warnings.push({ type: "orphaned", nodeId: n.id, label: nodeName(n) });
    }
  });

  nodes
    .filter((n) => n.type === "page" || n.type === "action")
    .forEach((n) => {
      const hasOutgoing = edges.some((e) => e.sourceNodeId === n.id);
      if (!hasOutgoing) {
        warnings.push({ type: "dead_end", nodeId: n.id, label: nodeName(n) });
      }
    });

  nodes
    .filter((n) => n.type === "branch")
    .forEach((n) => {
      const outgoing = edges.filter((e) => e.sourceNodeId === n.id);
      if (outgoing.length > 0 && !outgoing.some((e) => e.ruleGroup === null)) {
        warnings.push({ type: "no_fallback", nodeId: n.id, label: n.label ?? "Branch" });
      }
    });

  return warnings;
}

// ─── React Flow conversion ────────────────────────────────────────────────────

const RF_NODE_TYPE: Record<FlowNodeType, string> = {
  start: "startNode",
  page: "pageNode",
  branch: "branchNode",
  action: "actionNode",
  end: "endNode",
};

function toRFNodes(nodes: FlowNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: RF_NODE_TYPE[n.type] ?? "pageNode",
    position: { x: n.canvasX, y: n.canvasY },
    data: n as unknown as Record<string, unknown>,
  }));
}

function toRFEdges(edges: FlowEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    type: e.ruleGroup === null ? "fallbackEdge" : "conditionalEdge",
    data: e as unknown as Record<string, unknown>,
  }));
}

// ─── Custom nodes ─────────────────────────────────────────────────────────────

function PageNode({ id, data, selected }: NodeProps) {
  const n = data as unknown as FlowNode;
  const color = PAGE_TYPE_COLORS[n.page?.type ?? ""] ?? "var(--text-muted)";
  return (
    <div
      style={{
        position: "relative",
        background: "var(--bg-surface)",
        border: `2px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 10,
        padding: "8px 12px",
        minWidth: NODE_W,
        minHeight: NODE_H,
        boxShadow: selected ? "0 0 0 3px var(--accent-muted)" : "0 1px 4px rgba(0,0,0,0.06)",
        cursor: "default",
      }}
    >
      <NodeBadge id={id} />
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {n.page?.isEntry && <span style={{ fontSize: 10, color: "var(--accent)" }}>★</span>}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color,
            background: `${color}22`,
            border: `1px solid ${color}44`,
            borderRadius: 99,
            padding: "1px 6px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {n.page?.type ?? "page"}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-primary)",
          marginTop: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 140,
        }}
      >
        {n.page?.title ?? n.label ?? "Page"}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
}

function BranchNode({ id, data, selected }: NodeProps) {
  const n = data as unknown as FlowNode;
  return (
    <div
      style={{
        position: "relative",
        background: "var(--accent-muted)",
        border: `2px dashed ${selected ? "var(--accent)" : "var(--accent-hover)"}`,
        borderRadius: 10,
        padding: "8px 12px",
        minWidth: NODE_W,
        minHeight: NODE_H,
        boxShadow: selected ? "0 0 0 3px var(--accent-muted)" : "none",
        cursor: "pointer",
      }}
    >
      <NodeBadge id={id} />
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14, color: "var(--accent-hover)" }}>⑂</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent-hover)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 120,
          }}
        >
          {n.label ?? "Branch"}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
}

function StartNode({ selected }: NodeProps) {
  return (
    <div
      style={{
        background: "var(--success, #16a34a)",
        color: "#fff",
        border: `2px solid ${selected ? "var(--accent)" : "var(--success, #16a34a)"}`,
        borderRadius: 99,
        padding: "8px 16px",
        minWidth: 90,
        textAlign: "center",
        fontSize: 12,
        fontWeight: 700,
        boxShadow: selected ? "0 0 0 3px var(--accent-muted)" : "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      ● Start
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
}

function ActionNode({ id, data, selected }: NodeProps) {
  const n = data as unknown as FlowNode;
  const count = Array.isArray(n.actions) ? n.actions.length : 0;
  return (
    <div
      style={{
        position: "relative",
        background: "var(--bg-surface)",
        border: `2px solid ${selected ? "var(--accent)" : "var(--info, #6366f1)"}`,
        borderRadius: 10,
        padding: "8px 12px",
        minWidth: NODE_W,
        minHeight: NODE_H,
        boxShadow: selected ? "0 0 0 3px var(--accent-muted)" : "0 1px 4px rgba(0,0,0,0.06)",
        cursor: "pointer",
      }}
    >
      <NodeBadge id={id} />
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 13, color: "var(--info, #6366f1)" }}>⚙</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
          {n.label ?? "Action"}
        </span>
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
        {count} action{count === 1 ? "" : "s"}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
}

function EndNode({ id, data, selected }: NodeProps) {
  const n = data as unknown as FlowNode;
  return (
    <div
      style={{
        position: "relative",
        background: "var(--text-primary)",
        color: "var(--bg-surface)",
        border: `2px solid ${selected ? "var(--accent)" : "var(--text-primary)"}`,
        borderRadius: 10,
        padding: "8px 14px",
        minWidth: 120,
        textAlign: "center",
        boxShadow: selected ? "0 0 0 3px var(--accent-muted)" : "0 1px 4px rgba(0,0,0,0.06)",
        cursor: "pointer",
      }}
    >
      <NodeBadge id={id} />
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em" }}>◆ Goal</div>
      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{n.goalLabel ?? n.label ?? "End"}</div>
    </div>
  );
}

const handleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  background: "var(--accent)",
  border: "2px solid var(--bg-surface)",
};

// ─── Custom edges ─────────────────────────────────────────────────────────────

function ConditionalEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected,
}: EdgeProps) {
  const edge = data as unknown as FlowEdge;
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const summary = ruleSummary(edge?.ruleGroup ?? null);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? "var(--accent)" : "var(--border)",
          strokeWidth: selected ? 2.5 : 1.5,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            fontSize: 10,
            fontWeight: 500,
            background: selected ? "var(--accent-muted)" : "var(--bg-raised)",
            border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
            color: selected ? "var(--accent-hover)" : "var(--text-secondary)",
            borderRadius: 99,
            padding: "2px 7px",
            whiteSpace: "nowrap",
            maxWidth: 140,
            overflow: "hidden",
            textOverflow: "ellipsis",
            cursor: "pointer",
          }}
          className="nodrag nopan"
        >
          {summary}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

function FallbackEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? "var(--accent)" : "var(--text-muted)",
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: "6 3",
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            fontSize: 10,
            fontWeight: 600,
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            borderRadius: 99,
            padding: "2px 7px",
            letterSpacing: "0.04em",
            cursor: "pointer",
          }}
          className="nodrag nopan"
        >
          fallback
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = {
  pageNode: PageNode,
  branchNode: BranchNode,
  startNode: StartNode,
  actionNode: ActionNode,
  endNode: EndNode,
};
const edgeTypes = { conditionalEdge: ConditionalEdge, fallbackEdge: FallbackEdge };

// ─── Side panel: ConditionBuilder ─────────────────────────────────────────────

function ConditionBuilder({
  ruleGroup,
  setRuleGroup,
  audienceFieldKeys,
  datalistId,
}: {
  ruleGroup: RuleGroup;
  setRuleGroup: (rg: RuleGroup) => void;
  audienceFieldKeys: string[];
  datalistId: string;
}) {
  function addCondition() {
    setRuleGroup({
      ...ruleGroup,
      conditions: [...ruleGroup.conditions, { source: "form", field: "", operator: "eq", value: "" }],
    });
  }

  function updateCondition(idx: number, patch: Partial<Condition>) {
    setRuleGroup({
      ...ruleGroup,
      conditions: ruleGroup.conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    });
  }

  function removeCondition(idx: number) {
    setRuleGroup({ ...ruleGroup, conditions: ruleGroup.conditions.filter((_, i) => i !== idx) });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <datalist id={datalistId}>
        {audienceFieldKeys.map((k) => <option key={k} value={k} />)}
      </datalist>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={panelLabel}>Match</span>
        <select
          style={{ ...panelInput, padding: "4px 8px", fontSize: 11, flex: "none" }}
          value={ruleGroup.logic}
          onChange={(e) => setRuleGroup({ ...ruleGroup, logic: e.target.value as "and" | "or" })}
        >
          <option value="and">ALL (AND)</option>
          <option value="or">ANY (OR)</option>
        </select>
      </div>

      {ruleGroup.conditions.map((cond, idx) => {
        const noValue = OPERATORS.find((o) => o.value === cond.operator)?.noValue;
        return (
          <div key={idx} style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 5 }}>
                <select
                  style={{ ...panelInput, fontSize: 11 }}
                  value={cond.source}
                  onChange={(e) => {
                    const source = e.target.value as Condition["source"];
                    // Reset field to a sensible default for the new source.
                    const field = source === "time" ? "hour" : source === "context" ? "device" : "";
                    updateCondition(idx, { source, field });
                  }}
                >
                  <option value="form">form</option>
                  <option value="url">url</option>
                  <option value="record">record</option>
                  <option value="context">context</option>
                  <option value="time">time</option>
                </select>
                {cond.source === "time" ? (
                  <select
                    style={{ ...panelInput, fontSize: 11 }}
                    value={cond.field}
                    onChange={(e) => updateCondition(idx, { field: e.target.value })}
                  >
                    {TIME_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                ) : cond.source === "context" ? (
                  <select
                    style={{ ...panelInput, fontSize: 11 }}
                    value={cond.field}
                    onChange={(e) => updateCondition(idx, { field: e.target.value })}
                  >
                    {CONTEXT_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                ) : (
                  <input
                    style={{ ...panelInput, fontSize: 11 }}
                    placeholder={cond.source === "record" ? "field key" : cond.source === "url" ? "e.g. utm_source" : "e.g. email"}
                    list={cond.source === "record" ? datalistId : undefined}
                    value={cond.field}
                    onChange={(e) => updateCondition(idx, { field: e.target.value })}
                  />
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                <select
                  style={{ ...panelInput, fontSize: 11 }}
                  value={cond.operator}
                  onChange={(e) => updateCondition(idx, { operator: e.target.value as Operator, value: "" })}
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {!noValue && (
                  <input
                    style={{ ...panelInput, fontSize: 11 }}
                    placeholder={cond.operator === "between" ? "min,max" : "value"}
                    value={cond.value}
                    onChange={(e) => updateCondition(idx, { value: e.target.value })}
                  />
                )}
              </div>
            </div>
            <button
              type="button"
              style={panelDeleteBtn}
              onClick={() => removeCondition(idx)}
            >
              ×
            </button>
          </div>
        );
      })}

      <button type="button" style={addCondBtn} onClick={addCondition}>
        + Add condition
      </button>
    </div>
  );
}

// ─── Side panel: EdgeRulePanel ────────────────────────────────────────────────

function EdgeRulePanel({
  edge,
  edges,
  nodes,
  audienceFieldKeys,
  campaignSlug,
  onSave,
  onDelete,
  onClose,
}: {
  edge: FlowEdge;
  edges: FlowEdge[];
  nodes: FlowNode[];
  audienceFieldKeys: string[];
  campaignSlug: string;
  onSave: (updated: FlowEdge) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [isFallback, setIsFallback] = useState(edge.ruleGroup === null);
  const [ruleGroup, setRuleGroup] = useState<RuleGroup>(
    edge.ruleGroup ?? { logic: "and", conditions: [] }
  );

  const siblings = edges
    .filter((e) => e.sourceNodeId === edge.sourceNodeId && e.id !== edge.id)
    .sort((a, b) => a.ruleOrder - b.ruleOrder);
  const allFromSource = edges
    .filter((e) => e.sourceNodeId === edge.sourceNodeId)
    .sort((a, b) => a.ruleOrder - b.ruleOrder);
  const myIdx = allFromSource.findIndex((e) => e.id === edge.id);
  const siblingsHaveFallback = siblings.some((e) => e.ruleGroup === null);

  const sourceName = nodeName(nodes.find((n) => n.id === edge.sourceNodeId) ?? { id: "", type: "page", pageId: null, label: null, canvasX: 0, canvasY: 0 });
  const targetName = nodeName(nodes.find((n) => n.id === edge.targetNodeId) ?? { id: "", type: "page", pageId: null, label: null, canvasX: 0, canvasY: 0 });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({
      ...edge,
      ruleGroup: isFallback ? null : ruleGroup,
    });
  }

  return (
    <form onSubmit={handleSubmit} style={panelForm}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>Edit edge</span>
        <button type="button" onClick={onClose} style={panelCloseBtn}>✕</button>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 14, background: "var(--bg-raised)", borderRadius: 6, padding: "7px 10px" }}>
        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{sourceName}</span>
        <span style={{ margin: "0 6px", color: "var(--text-muted)" }}>→</span>
        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{targetName}</span>
      </div>

      {/* Evaluation order */}
      {allFromSource.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={panelLabel}>Priority</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {myIdx + 1} of {allFromSource.length}
          </span>
        </div>
      )}

      {/* Fallback toggle */}
      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, cursor: "pointer", marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={isFallback}
          onChange={(e) => setIsFallback(e.target.checked)}
        />
        Fallback (matches when no other rule does)
      </label>

      {isFallback && siblingsHaveFallback && (
        <div style={warnBox}>⚠ A fallback already exists from this node. Only one fallback per source is expected.</div>
      )}

      {/* Conditions */}
      {!isFallback && (
        <ConditionBuilder
          ruleGroup={ruleGroup}
          setRuleGroup={setRuleGroup}
          audienceFieldKeys={audienceFieldKeys}
          datalistId={`afd-${campaignSlug}-${edge.id}`}
        />
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
        <button type="submit" style={panelSaveBtn}>Save</button>
        <button type="button" style={panelDeleteEdgeBtn} onClick={() => onDelete(edge.id)}>
          Delete edge
        </button>
      </div>
    </form>
  );
}

// ─── Side panel: BranchNodePanel ─────────────────────────────────────────────

function BranchNodePanel({
  node,
  edges,
  nodes,
  issue,
  onSaveLabel,
  onSavePatch,
  onUpdateEdgeWeight,
  onDeleteNode,
  onClose,
  onSelectEdge,
  onReorderEdge,
}: {
  node: FlowNode;
  edges: FlowEdge[];
  nodes: FlowNode[];
  issue?: NodeIssue;
  onSaveLabel: (id: string, label: string) => void;
  onSavePatch: (id: string, patch: Partial<FlowNode>) => void;
  onUpdateEdgeWeight: (edgeId: string, weight: number) => void;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
  onSelectEdge: (edgeId: string) => void;
  onReorderEdge: (edgeId: string, dir: "up" | "down") => void;
}) {
  const [label, setLabel] = useState(node.label ?? "");
  const isSplit = (node.config as { mode?: string } | null)?.mode === "split";
  const outgoing = edges
    .filter((e) => e.sourceNodeId === node.id)
    .sort((a, b) => a.ruleOrder - b.ruleOrder);
  const totalWeight = outgoing.reduce((sum, e) => sum + Math.max(0, e.weight ?? 1), 0) || 1;

  return (
    <div style={panelForm}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Branch node</span>
        <button type="button" onClick={onClose} style={panelCloseBtn}>✕</button>
      </div>

      <IssueNote issue={issue} />

      <label style={{ ...panelLabel, display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
        Label
        <input
          style={panelInput}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Route by tier"
        />
      </label>
      <button
        type="button"
        style={{ ...panelSaveBtn, marginBottom: 14 }}
        onClick={() => onSaveLabel(node.id, label)}
      >
        Save label
      </button>

      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, cursor: "pointer", marginBottom: 16 }}>
        <input
          type="checkbox"
          checked={isSplit}
          onChange={(e) => onSavePatch(node.id, { config: e.target.checked ? { mode: "split" } : null })}
        />
        A/B split (route by weight, sticky per visitor)
      </label>

      {outgoing.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
            Outgoing edges ({outgoing.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {outgoing.map((e, idx) => {
              const target = nodes.find((n) => n.id === e.targetNodeId);
              const w = Math.max(0, e.weight ?? 1);
              return (
                <div
                  key={e.id}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 10px", cursor: isSplit ? "default" : "pointer" }}
                  onClick={() => { if (!isSplit) onSelectEdge(e.id); }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      → {target ? nodeName(target) : "?"}
                    </div>
                    {isSplit ? (
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                        {Math.round((w / totalWeight) * 100)}% of traffic
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                        {e.ruleGroup === null ? "fallback" : ruleSummary(e.ruleGroup)}
                      </div>
                    )}
                  </div>
                  {isSplit ? (
                    <input
                      type="number"
                      min={0}
                      style={{ ...panelInput, fontSize: 11, width: 56, flex: "none" }}
                      value={w}
                      onClick={(ev) => ev.stopPropagation()}
                      onChange={(ev) => onUpdateEdgeWeight(e.id, Math.max(0, Number(ev.target.value)))}
                    />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <button
                        type="button"
                        style={reorderBtn}
                        disabled={idx === 0}
                        onClick={(ev) => { ev.stopPropagation(); onReorderEdge(e.id, "up"); }}
                      >↑</button>
                      <button
                        type="button"
                        style={reorderBtn}
                        disabled={idx === outgoing.length - 1}
                        onClick={(ev) => { ev.stopPropagation(); onReorderEdge(e.id, "down"); }}
                      >↓</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        style={{ ...panelDeleteEdgeBtn, marginTop: 16 }}
        onClick={() => {
          if (!confirm("Remove this branch node and all its edges?")) return;
          onDeleteNode(node.id);
        }}
      >
        Delete branch
      </button>
    </div>
  );
}

// ─── Add branch form ──────────────────────────────────────────────────────────

function AddBranchForm({ onAdd, onCancel }: { onAdd: (label: string) => void; onCancel: () => void }) {
  const [label, setLabel] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (label.trim()) { onAdd(label.trim()); } }}
      style={{ display: "flex", gap: 6, alignItems: "center" }}
    >
      <input
        style={{ ...panelInput, fontSize: 12, flex: 1 }}
        autoFocus
        required
        placeholder="Branch label, e.g. Route by tier"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <button type="submit" style={panelSaveBtn}>Add</button>
      <button type="button" style={panelDeleteEdgeBtn} onClick={onCancel}>Cancel</button>
    </form>
  );
}

// ─── Side panel: EndNodePanel ────────────────────────────────────────────────

function EndNodePanel({
  node,
  onSave,
  onDeleteNode,
  onClose,
}: {
  node: FlowNode;
  onSave: (id: string, patch: Partial<FlowNode>) => void;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(node.goalLabel ?? "");
  const [key, setKey] = useState(node.goalKey ?? "");

  function autoKey(v: string) {
    return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  return (
    <div style={panelForm}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>End — named goal</span>
        <button type="button" onClick={onClose} style={panelCloseBtn}>✕</button>
      </div>

      <label style={{ ...panelLabel, display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
        Goal name
        <input
          style={panelInput}
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            if (!node.goalKey) setKey(autoKey(e.target.value));
          }}
          placeholder="e.g. Purchased"
        />
      </label>
      <label style={{ ...panelLabel, display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
        Goal key (for exports/webhooks)
        <input
          style={panelInput}
          value={key}
          onChange={(e) => setKey(autoKey(e.target.value))}
          placeholder="purchased"
        />
      </label>

      <button
        type="button"
        style={{ ...panelSaveBtn, marginBottom: 16 }}
        onClick={() => onSave(node.id, { goalLabel: label.trim() || null, goalKey: key.trim() || null })}
      >
        Save goal
      </button>

      <button
        type="button"
        style={panelDeleteEdgeBtn}
        onClick={() => {
          if (!confirm("Remove this End node and its edges?")) return;
          onDeleteNode(node.id);
        }}
      >
        Delete End
      </button>
    </div>
  );
}

// ─── Side panel: ActionNodePanel ─────────────────────────────────────────────

const ACTION_SOURCES = ["form", "url", "record", "context"] as const;

function ActionNodePanel({
  node,
  audienceFieldKeys,
  onSave,
  onDeleteNode,
  onClose,
}: {
  node: FlowNode;
  audienceFieldKeys: string[];
  onSave: (id: string, patch: Partial<FlowNode>) => void;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(node.label ?? "");
  const [actions, setActions] = useState<FlowAction[]>(
    Array.isArray(node.actions) ? node.actions : []
  );

  function update(idx: number, next: FlowAction) {
    setActions(actions.map((a, i) => (i === idx ? next : a)));
  }
  function remove(idx: number) {
    setActions(actions.filter((_, i) => i !== idx));
  }
  function add(op: FlowAction["op"]) {
    const blank: Record<FlowAction["op"], FlowAction> = {
      set: { op: "set", field: "", value: "" },
      copy: { op: "copy", field: "", from: { source: "form", key: "" } },
      compute: { op: "compute", field: "", expr: "increment", args: [] },
      tag: { op: "tag", add: [] },
    };
    setActions([...actions, blank[op]]);
  }

  const dl = `act-fields-${node.id}`;

  return (
    <div style={panelForm}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Action node</span>
        <button type="button" onClick={onClose} style={panelCloseBtn}>✕</button>
      </div>

      <datalist id={dl}>
        {audienceFieldKeys.map((k) => <option key={k} value={k} />)}
      </datalist>

      <label style={{ ...panelLabel, display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
        Label
        <input style={panelInput} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Mark qualified" />
      </label>

      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
        Actions ({actions.length})
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {actions.map((a, idx) => (
          <div key={idx} style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 6, padding: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <strong style={{ fontSize: 11, color: "var(--text-secondary)" }}>{a.op}</strong>
              <button type="button" style={panelCloseBtn} onClick={() => remove(idx)}>✕</button>
            </div>

            {a.op === "set" && (
              <div style={{ display: "flex", gap: 5 }}>
                <input list={dl} style={{ ...panelInput, fontSize: 12 }} placeholder="field" value={a.field}
                  onChange={(e) => update(idx, { ...a, field: e.target.value })} />
                <input style={{ ...panelInput, fontSize: 12 }} placeholder="value" value={a.value}
                  onChange={(e) => update(idx, { ...a, value: e.target.value })} />
              </div>
            )}

            {a.op === "copy" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <input list={dl} style={{ ...panelInput, fontSize: 12 }} placeholder="target field" value={a.field}
                  onChange={(e) => update(idx, { ...a, field: e.target.value })} />
                <div style={{ display: "flex", gap: 5 }}>
                  <select style={{ ...panelInput, fontSize: 12 }} value={a.from.source}
                    onChange={(e) => update(idx, { ...a, from: { ...a.from, source: e.target.value as typeof a.from.source } })}>
                    {ACTION_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input style={{ ...panelInput, fontSize: 12 }} placeholder="key" value={a.from.key}
                    onChange={(e) => update(idx, { ...a, from: { ...a.from, key: e.target.value } })} />
                </div>
              </div>
            )}

            {a.op === "compute" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <input list={dl} style={{ ...panelInput, fontSize: 12 }} placeholder="target field" value={a.field}
                  onChange={(e) => update(idx, { ...a, field: e.target.value })} />
                <div style={{ display: "flex", gap: 5 }}>
                  <select style={{ ...panelInput, fontSize: 12 }} value={a.expr}
                    onChange={(e) => update(idx, { ...a, expr: e.target.value as typeof a.expr })}>
                    <option value="increment">increment</option>
                    <option value="sum">sum</option>
                    <option value="concat">concat</option>
                  </select>
                  <input style={{ ...panelInput, fontSize: 12 }} placeholder="args (comma-sep fields)"
                    value={a.args.join(",")}
                    onChange={(e) => update(idx, { ...a, args: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                </div>
              </div>
            )}

            {a.op === "tag" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <input style={{ ...panelInput, fontSize: 12 }} placeholder="add tags (comma-sep)"
                  value={(a.add ?? []).join(",")}
                  onChange={(e) => update(idx, { ...a, add: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                <input style={{ ...panelInput, fontSize: 12 }} placeholder="remove tags (comma-sep)"
                  value={(a.remove ?? []).join(",")}
                  onChange={(e) => update(idx, { ...a, remove: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
        {(["set", "copy", "compute", "tag"] as const).map((op) => (
          <button key={op} type="button" style={addCondBtn} onClick={() => add(op)}>+ {op}</button>
        ))}
      </div>

      <button
        type="button"
        style={{ ...panelSaveBtn, marginTop: 16 }}
        onClick={() => onSave(node.id, { label: label.trim() || null, actions })}
      >
        Save action
      </button>
      <button
        type="button"
        style={{ ...panelDeleteEdgeBtn, marginTop: 8 }}
        onClick={() => {
          if (!confirm("Remove this Action node and its edges?")) return;
          onDeleteNode(node.id);
        }}
      >
        Delete Action
      </button>
    </div>
  );
}

// ─── Side panel: SimulatorPanel ──────────────────────────────────────────────

interface SimStepUI { nodeId: string; type: string; label: string | null; patch?: Record<string, unknown>; }
interface SimResultUI {
  visited: SimStepUI[];
  goal: { key: string | null; label: string | null } | null;
  fields: Record<string, unknown>;
  deadEnd: boolean;
  truncated: boolean;
}
interface IssueUI { level: "error" | "warning"; code: string; message: string; nodeId?: string }

function SimulatorPanel({
  campaignSlug,
  nodes,
  onClose,
}: {
  campaignSlug: string;
  nodes: FlowNode[];
  onClose: () => void;
}) {
  const [form, setForm] = useState("");
  const [record, setRecord] = useState("");
  const [context, setContext] = useState("");
  const [seed, setSeed] = useState("");
  const [result, setResult] = useState<SimResultUI | null>(null);
  const [issues, setIssues] = useState<IssueUI[]>([]);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    nodes.forEach((n) => m.set(n.id, nodeName(n)));
    return m;
  }, [nodes]);

  function parseKV(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    text.split(/[\n,]/).forEach((line) => {
      const i = line.indexOf("=");
      if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    return out;
  }

  async function run() {
    setRunning(true);
    setErr(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignSlug}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({
          form: parseKV(form),
          record: parseKV(record),
          context: parseKV(context),
          seed: seed.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? "Simulation failed"); return; }
      setResult(d.result);
      setIssues(d.issues ?? []);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={panelForm}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Test visitor</span>
        <button type="button" onClick={onClose} style={panelCloseBtn}>✕</button>
      </div>

      <label style={{ ...panelLabel, display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
        Form values (key=value per line)
        <textarea style={{ ...panelInput, fontSize: 12, minHeight: 50, fontFamily: "monospace" }} value={form}
          onChange={(e) => setForm(e.target.value)} placeholder={"email=a@b.com\nqty=6"} />
      </label>
      <label style={{ ...panelLabel, display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
        Audience record fields (key=value per line)
        <textarea style={{ ...panelInput, fontSize: 12, minHeight: 50, fontFamily: "monospace" }} value={record}
          onChange={(e) => setRecord(e.target.value)} placeholder={"tier=gold"} />
      </label>
      <label style={{ ...panelLabel, display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
        Visitor context (device/geo/source)
        <textarea style={{ ...panelInput, fontSize: 12, minHeight: 40, fontFamily: "monospace" }} value={context}
          onChange={(e) => setContext(e.target.value)} placeholder={"device=mobile\ncountry=US"} />
      </label>
      <label style={{ ...panelLabel, display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
        A/B seed (optional — pick an arm)
        <input style={{ ...panelInput, fontSize: 12 }} value={seed}
          onChange={(e) => setSeed(e.target.value)} placeholder="visitor-123" />
      </label>

      <button type="button" style={panelSaveBtn} disabled={running} onClick={run}>
        {running ? "Running…" : "▶ Simulate"}
      </button>

      {err && <div style={{ ...warnBox, marginTop: 10 }}>{err}</div>}

      {issues.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            Validation
          </div>
          {issues.map((iss, i) => (
            <div key={i} style={{ fontSize: 11, color: iss.level === "error" ? "var(--danger)" : "var(--warning, #92610a)", marginBottom: 4 }}>
              {iss.level === "error" ? "✕" : "⚠"} {iss.message}
            </div>
          ))}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            Path
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {result.visited.map((s, i) => (
              <div key={i} style={{ fontSize: 12, color: "var(--text-primary)", display: "flex", gap: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>{i + 1}.</span>
                <span>{nameById.get(s.nodeId) ?? s.label ?? s.type}</span>
                {s.patch && Object.keys(s.patch).length > 0 && (
                  <span style={{ fontSize: 10, color: "var(--info, #6366f1)" }}>
                    {Object.entries(s.patch).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 12 }}>
            {result.goal ? (
              <span style={{ color: "var(--success)" }}>✓ Goal reached: <strong>{result.goal.label ?? result.goal.key}</strong></span>
            ) : result.truncated ? (
              <span style={{ color: "var(--danger)" }}>✕ Stopped (possible cycle)</span>
            ) : (
              <span style={{ color: "var(--warning, #92610a)" }}>⚠ Ended without reaching a goal</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Side panel: PageNodePanel ───────────────────────────────────────────────

function IssueNote({ issue }: { issue?: NodeIssue }) {
  if (!issue) return null;
  const color = issue.level === "error" ? "var(--danger)" : "var(--warning, #92610a)";
  const bg = issue.level === "error" ? "var(--danger-muted, #fdecec)" : "var(--warning-muted, #fef9e7)";
  return (
    <div style={{ background: bg, border: `1px solid ${color}`, borderRadius: 6, padding: "8px 10px", marginBottom: 14 }}>
      {issue.messages.map((m, i) => (
        <div key={i} style={{ fontSize: 11, color, marginBottom: i < issue.messages.length - 1 ? 4 : 0 }}>
          {issue.level === "error" ? "✕" : "⚠"} {m}
        </div>
      ))}
    </div>
  );
}

function PageNodePanel({
  node,
  campaignSlug,
  issue,
  canEdit,
  onDeleteNode,
  onClose,
}: {
  node: FlowNode;
  campaignSlug: string;
  issue?: NodeIssue;
  canEdit: boolean;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div style={panelForm}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Page</span>
        <button type="button" onClick={onClose} style={panelCloseBtn}>✕</button>
      </div>

      <IssueNote issue={issue} />

      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
        {node.page?.title ?? node.label ?? "Page"}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>
        {node.page?.type ?? "page"} · {node.page?.path ?? "/"}
      </div>

      {node.pageId && (
        <a
          href={`/campaigns/${campaignSlug}/compose/${node.pageId}`}
          style={{ ...panelSaveBtn, textDecoration: "none", display: "inline-block", textAlign: "center", marginBottom: 10 }}
        >
          Edit page content →
        </a>
      )}

      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
        Drag from this node&apos;s bottom handle to connect it onward, or to an End node to finish the flow.
      </div>

      {canEdit && (
        <button
          type="button"
          style={{ ...panelDeleteEdgeBtn, marginTop: 16 }}
          onClick={() => {
            if (!confirm("Remove this page node from the flow? (The page itself is not deleted.)")) return;
            onDeleteNode(node.id);
          }}
        >
          Remove from flow
        </button>
      )}
    </div>
  );
}

// ─── Add page form ────────────────────────────────────────────────────────────

function AddPageForm({ onAdd, onCancel }: { onAdd: (title: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (title.trim()) onAdd(title.trim()); }}
      style={{ display: "flex", gap: 6, alignItems: "center" }}
    >
      <input
        style={{ ...panelInput, fontSize: 12, flex: 1 }}
        autoFocus
        required
        placeholder="Page title, e.g. Landing"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button type="submit" style={panelSaveBtn}>Add</button>
      <button type="button" style={panelDeleteEdgeBtn} onClick={onCancel}>Cancel</button>
    </form>
  );
}

// ─── Main FlowEditor ──────────────────────────────────────────────────────────

export function FlowEditor({
  campaignSlug,
  initialNodes,
  initialEdges,
  canEdit,
  audienceFieldKeys = [],
}: {
  campaignSlug: string;
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
  canEdit: boolean;
  audienceFieldKeys?: string[];
}) {
  const [myNodes, setMyNodes] = useState<FlowNode[]>(initialNodes);
  const [myEdges, setMyEdges] = useState<FlowEdge[]>(initialEdges);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Side panel state
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Add branch / page form visibility
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [showAddPage, setShowAddPage] = useState(false);
  // Simulator panel visibility
  const [showSimulator, setShowSimulator] = useState(false);

  // React Flow instance (for panning/zooming to a node)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  // React Flow state — initialized from our arrays, then managed explicitly (no sync effects)
  const [rfNodes, setRfNodes, onRFNodesChange] = useNodesState(toRFNodes(initialNodes));
  const [rfEdges, setRfEdges, onRFEdgesChange] = useEdgesState(toRFEdges(initialEdges));

  // Select a node, open its panel, and pan/zoom the canvas to it.
  const focusNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      setShowSimulator(false);
      if (rfInstance && rfNodes.some((n) => n.id === nodeId)) {
        rfInstance.fitView({ nodes: [{ id: nodeId }], duration: 500, padding: 0.45, maxZoom: 1.3 });
      }
    },
    [rfInstance, rfNodes]
  );

  // Validation
  const warnings = useMemo(() => validateFlow(myNodes, myEdges), [myNodes, myEdges]);

  // Group warnings by node so each node can show its own badge.
  const issuesByNode = useMemo(() => {
    const m = new Map<string, NodeIssue>();
    for (const w of warnings) {
      const msg = warningText(w);
      const existing = m.get(w.nodeId);
      if (existing) {
        existing.count += 1;
        existing.messages.push(msg);
      } else {
        m.set(w.nodeId, { level: "warning", count: 1, messages: [msg] });
      }
    }
    return m;
  }, [warnings]);

  async function save(nodes: FlowNode[], edges: FlowEdge[]) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignSlug}/flow`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ nodes, edges }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSaveError(d.error ?? "Save failed");
        return false;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      return true;
    } finally {
      setSaving(false);
    }
  }

  // Handle node drag end — read final position directly from the change object
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onRFNodesChange(changes);
      // NodePositionChange has { type: 'position', dragging: false, position: {x,y} } at drag end
      type PosCh = { type: "position"; id: string; dragging?: boolean; position?: { x: number; y: number } };
      const dragEnd = (changes as PosCh[]).filter(
        (c) => c.type === "position" && c.dragging === false && c.position !== undefined
      );
      if (dragEnd.length === 0) return;
      const posMap: Record<string, { x: number; y: number }> = {};
      for (const c of dragEnd) posMap[c.id] = c.position!;
      const updated = myNodes.map((n) => {
        const pos = posMap[n.id];
        return pos ? { ...n, canvasX: pos.x, canvasY: pos.y } : n;
      });
      setMyNodes(updated);
      save(updated, myEdges);
    },
    [myNodes, myEdges, onRFNodesChange]
  );

  // Handle new connection drawn on canvas
  const handleConnect = useCallback(
    (conn: Connection) => {
      if (!canEdit || !conn.source || !conn.target) return;
      const maxOrder = myEdges
        .filter((e) => e.sourceNodeId === conn.source)
        .reduce((m, e) => Math.max(m, e.ruleOrder), -1);
      const newEdge: FlowEdge = {
        id: genId(),
        sourceNodeId: conn.source,
        targetNodeId: conn.target,
        ruleGroup: { logic: "and", conditions: [] },
        ruleOrder: maxOrder + 1,
      };
      const updated = [...myEdges, newEdge];
      setMyEdges(updated);
      setRfEdges(toRFEdges(updated));
      save(myNodes, updated);
      // Open side panel for the new edge
      setSelectedEdgeId(newEdge.id);
      setSelectedNodeId(null);
    },
    [canEdit, myNodes, myEdges]
  );

  // Auto-layout
  function applyLayout(direction: "TB" | "LR") {
    const laid = applyDagreLayout(myNodes, myEdges, direction);
    setMyNodes(laid);
    setRfNodes(toRFNodes(laid));
    save(laid, myEdges);
  }

  // Add branch node
  function addBranch(label: string) {
    const node: FlowNode = {
      id: genId(),
      type: "branch",
      pageId: null,
      label,
      canvasX: 200,
      canvasY: myNodes.length * 100,
    };
    const updated = [...myNodes, node];
    setMyNodes(updated);
    setRfNodes(toRFNodes(updated));
    setShowAddBranch(false);
    save(updated, myEdges);
  }

  // Reload the flow from the server (after a server-side mutation like page create).
  async function refetchFlow() {
    const res = await fetch(`/api/campaigns/${campaignSlug}/flow`);
    if (!res.ok) return;
    const d = await res.json();
    setMyNodes(d.nodes);
    setMyEdges(d.edges);
    setRfNodes(toRFNodes(d.nodes));
    setRfEdges(toRFEdges(d.edges));
  }

  // Add a Page node — creates the page (+ composition + flow node) server-side,
  // then resyncs the canvas. One action wires structure and content together.
  async function addPage(title: string) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignSlug}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ title, type: "landing" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveError(d.error ?? "Could not create page");
        return;
      }
      await refetchFlow();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
      setShowAddPage(false);
    }
  }

  // Add a start / action / end node and select it for editing
  function addNode(type: "start" | "action" | "end") {
    const node: FlowNode = {
      id: genId(),
      type,
      pageId: null,
      label: type === "action" ? "Action" : null,
      goalLabel: type === "end" ? "Goal" : null,
      goalKey: type === "end" ? "goal" : null,
      actions: type === "action" ? [] : null,
      canvasX: 200,
      canvasY: myNodes.length * 100,
    };
    const updated = [...myNodes, node];
    setMyNodes(updated);
    setRfNodes(toRFNodes(updated));
    save(updated, myEdges);
    if (type !== "start") {
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
    }
  }

  // Generic node field update (goal / action / label) from a panel
  function saveNodePatch(nodeId: string, patch: Partial<FlowNode>) {
    const updated = myNodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n));
    setMyNodes(updated);
    setRfNodes(toRFNodes(updated));
    save(updated, myEdges);
  }

  // Remove node + its edges
  function removeNode(nodeId: string) {
    const updNodes = myNodes.filter((n) => n.id !== nodeId);
    const updEdges = myEdges.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId);
    setMyNodes(updNodes);
    setMyEdges(updEdges);
    setRfNodes(toRFNodes(updNodes));
    setRfEdges(toRFEdges(updEdges));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    save(updNodes, updEdges);
  }

  // Save branch label (label-only update, no RF structural change needed)
  function saveBranchLabel(nodeId: string, label: string) {
    const updated = myNodes.map((n) => n.id === nodeId ? { ...n, label } : n);
    setMyNodes(updated);
    save(updated, myEdges);
  }

  // Save edge (from panel)
  function saveEdge(updated: FlowEdge) {
    const updEdges = myEdges.map((e) => e.id === updated.id ? updated : e);
    setMyEdges(updEdges);
    setRfEdges(toRFEdges(updEdges));
    setSelectedEdgeId(null);
    save(myNodes, updEdges);
  }

  // Update an edge's A/B split weight
  function updateEdgeWeight(edgeId: string, weight: number) {
    const updated = myEdges.map((e) => (e.id === edgeId ? { ...e, weight } : e));
    setMyEdges(updated);
    setRfEdges(toRFEdges(updated));
    save(myNodes, updated);
  }

  // Delete edge
  function deleteEdge(edgeId: string) {
    const updated = myEdges.filter((e) => e.id !== edgeId);
    setMyEdges(updated);
    setRfEdges(toRFEdges(updated));
    setSelectedEdgeId(null);
    save(myNodes, updated);
  }

  // Reorder edge within siblings
  function reorderEdge(edgeId: string, dir: "up" | "down") {
    const edge = myEdges.find((e) => e.id === edgeId);
    if (!edge) return;
    const siblings = myEdges
      .filter((e) => e.sourceNodeId === edge.sourceNodeId)
      .sort((a, b) => a.ruleOrder - b.ruleOrder);
    const idx = siblings.findIndex((e) => e.id === edgeId);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const newOrders: Record<string, number> = {};
    reordered.forEach((e, i) => { newOrders[e.id] = i; });
    const updated = myEdges.map((e) =>
      newOrders[e.id] !== undefined ? { ...e, ruleOrder: newOrders[e.id] } : e
    );
    setMyEdges(updated);
    save(myNodes, updated);
  }

  const selectedEdge = myEdges.find((e) => e.id === selectedEdgeId) ?? null;
  const selectedNode = myNodes.find((n) => n.id === selectedNodeId) ?? null;
  const panelOpen = !!(selectedEdge || selectedNode || showSimulator);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 220px)", minHeight: 500 }}>
      {/* Toolbar */}
      <div style={toolbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          {canEdit && (
            <>
              <button style={toolbarBtn} onClick={() => applyLayout("LR")} title="Horizontal auto-layout">
                ↔ Layout H
              </button>
              <button style={toolbarBtn} onClick={() => applyLayout("TB")} title="Vertical auto-layout">
                ↕ Layout V
              </button>
              <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 2px" }} />
              {showAddBranch ? (
                <AddBranchForm onAdd={addBranch} onCancel={() => setShowAddBranch(false)} />
              ) : showAddPage ? (
                <AddPageForm onAdd={addPage} onCancel={() => setShowAddPage(false)} />
              ) : (
                <>
                  <button style={toolbarBtn} onClick={() => addNode("start")}>+ Start</button>
                  <button style={toolbarBtn} onClick={() => setShowAddPage(true)}>+ Page</button>
                  <button style={toolbarBtn} onClick={() => setShowAddBranch(true)}>+ Branch</button>
                  <button style={toolbarBtn} onClick={() => addNode("action")}>+ Action</button>
                  <button style={toolbarBtn} onClick={() => addNode("end")}>+ End</button>
                </>
              )}
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {saving && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Saving…</span>}
          {saved && <span style={{ fontSize: 12, color: "var(--success)" }}>Saved</span>}
          {saveError && <span style={{ fontSize: 12, color: "var(--danger)" }}>{saveError}</span>}
          <button
            style={{ ...toolbarBtn, borderColor: showSimulator ? "var(--accent)" : "var(--border)", color: showSimulator ? "var(--accent)" : "var(--text-secondary)" }}
            onClick={() => { setShowSimulator((s) => !s); setSelectedEdgeId(null); setSelectedNodeId(null); }}
          >
            ▶ Test
          </button>
        </div>
      </div>

      {/* Validation warnings */}
      {warnings.length > 0 && (
        <div style={warningBanner}>
          {warnings.map((w, i) => (
            <div
              key={i}
              style={{ fontSize: 12, cursor: "pointer" }}
              title="Go to this node on the canvas"
              onClick={() => focusNode(w.nodeId)}
            >
              ⚠ {warningText(w)}
            </div>
          ))}
        </div>
      )}

      {/* Canvas + side panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)", border: "1px solid var(--border)", borderTop: "none" }}>
        <NodeIssuesContext.Provider value={issuesByNode}>
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onInit={setRfInstance}
            onNodesChange={handleNodesChange}
            onEdgesChange={onRFEdgesChange}
            onConnect={canEdit ? handleConnect : undefined}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onEdgeClick={(_: React.MouseEvent, edge: Edge) => {
              setSelectedEdgeId(edge.id);
              setSelectedNodeId(null);
            }}
            onNodeClick={(_: React.MouseEvent, node: Node) => {
              if (["pageNode", "branchNode", "actionNode", "endNode"].includes(node.type ?? "")) {
                setSelectedNodeId(node.id);
                setSelectedEdgeId(null);
                setShowSimulator(false);
              }
            }}
            onPaneClick={() => {
              setSelectedEdgeId(null);
              setSelectedNodeId(null);
            }}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable={true}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--border-subtle, #e8edf5)" gap={16} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(n) => n.type === "branchNode" ? "var(--accent-muted)" : "var(--bg-surface)"}
              style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
            />
          </ReactFlow>
        </div>
        </NodeIssuesContext.Provider>

        {/* Side panel */}
        {panelOpen && (
          <div style={sidePanel}>
            {selectedEdge && (
              <EdgeRulePanel
                edge={selectedEdge}
                edges={myEdges}
                nodes={myNodes}
                audienceFieldKeys={audienceFieldKeys}
                campaignSlug={campaignSlug}
                onSave={saveEdge}
                onDelete={deleteEdge}
                onClose={() => setSelectedEdgeId(null)}
              />
            )}
            {selectedNode && selectedNode.type === "page" && (
              <PageNodePanel
                node={selectedNode}
                campaignSlug={campaignSlug}
                issue={issuesByNode.get(selectedNode.id)}
                canEdit={canEdit}
                onDeleteNode={removeNode}
                onClose={() => setSelectedNodeId(null)}
              />
            )}
            {selectedNode && selectedNode.type === "branch" && (
              <BranchNodePanel
                node={selectedNode}
                edges={myEdges}
                nodes={myNodes}
                issue={issuesByNode.get(selectedNode.id)}
                onSaveLabel={saveBranchLabel}
                onSavePatch={saveNodePatch}
                onUpdateEdgeWeight={updateEdgeWeight}
                onDeleteNode={removeNode}
                onClose={() => setSelectedNodeId(null)}
                onSelectEdge={(id) => { setSelectedEdgeId(id); setSelectedNodeId(null); }}
                onReorderEdge={reorderEdge}
              />
            )}
            {selectedNode && selectedNode.type === "action" && (
              <ActionNodePanel
                node={selectedNode}
                audienceFieldKeys={audienceFieldKeys}
                onSave={saveNodePatch}
                onDeleteNode={removeNode}
                onClose={() => setSelectedNodeId(null)}
              />
            )}
            {selectedNode && selectedNode.type === "end" && (
              <EndNodePanel
                node={selectedNode}
                onSave={saveNodePatch}
                onDeleteNode={removeNode}
                onClose={() => setSelectedNodeId(null)}
              />
            )}
            {showSimulator && !selectedNode && !selectedEdge && (
              <SimulatorPanel
                campaignSlug={campaignSlug}
                nodes={myNodes}
                onClose={() => setShowSimulator(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const toolbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderBottom: "none",
  borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
  flexWrap: "wrap",
};

const toolbarBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text-secondary)",
  cursor: "pointer",
};

const warningBanner: React.CSSProperties = {
  background: "var(--warning-muted, #fef9e7)",
  border: "1px solid var(--warning, #d4a017)",
  borderBottom: "none",
  padding: "8px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  color: "var(--warning, #92610a)",
};

const sidePanel: React.CSSProperties = {
  width: 320,
  flexShrink: 0,
  borderLeft: "1px solid var(--border)",
  background: "var(--bg-surface)",
  overflowY: "auto",
};

const panelForm: React.CSSProperties = {
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: 0,
};

const panelLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
};

const panelInput: React.CSSProperties = {
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "6px 8px",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const panelCloseBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 13,
  color: "var(--text-muted)",
  cursor: "pointer",
  padding: "2px 4px",
};

const panelSaveBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--text-inverse)",
  border: "none",
  borderRadius: 6,
  padding: "7px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const panelDeleteEdgeBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "7px 10px",
  fontSize: 12,
  color: "var(--danger)",
  cursor: "pointer",
};

const panelDeleteBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
  padding: "2px 4px",
  borderRadius: 4,
  flexShrink: 0,
  marginTop: 2,
};

const addCondBtn: React.CSSProperties = {
  background: "none",
  border: "1px dashed var(--border)",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 11,
  color: "var(--text-secondary)",
  cursor: "pointer",
  alignSelf: "flex-start",
  marginTop: 4,
};

const reorderBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 10,
  color: "var(--text-muted)",
  cursor: "pointer",
  padding: 0,
  lineHeight: 1.4,
};

const warnBox: React.CSSProperties = {
  background: "var(--warning-muted, #fef9e7)",
  border: "1px solid var(--warning, #d4a017)",
  borderRadius: 6,
  padding: "7px 10px",
  fontSize: 11,
  color: "var(--warning, #92610a)",
  marginBottom: 10,
};
