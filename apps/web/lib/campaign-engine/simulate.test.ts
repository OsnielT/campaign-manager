/**
 * Pure simulate + validate tests. Run with:
 *   npx tsx --test lib/campaign-engine/simulate.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateFlow, validateFlow, type SimNode, type SimEdge } from "./simulate";

// start → page → branch(tier) → [gold: action(tag vip) → end:Purchased] | [fallback → end:Declined]
function buildFlow(): { nodes: SimNode[]; edges: SimEdge[] } {
  const nodes: SimNode[] = [
    { id: "start", type: "start" },
    { id: "page", type: "page", pageId: "p1", label: "Landing" },
    { id: "branch", type: "branch", label: "Tier?" },
    { id: "action", type: "action", label: "Tag VIP", actions: [{ op: "tag", add: ["vip"] }] },
    { id: "end-gold", type: "end", goalKey: "purchased", goalLabel: "Purchased" },
    { id: "end-other", type: "end", goalKey: "declined", goalLabel: "Declined" },
  ];
  const edges: SimEdge[] = [
    { id: "e0", sourceNodeId: "start", targetNodeId: "page", ruleGroup: null, ruleOrder: 0 },
    { id: "e1", sourceNodeId: "page", targetNodeId: "branch", ruleGroup: null, ruleOrder: 0 },
    {
      id: "e2",
      sourceNodeId: "branch",
      targetNodeId: "action",
      ruleOrder: 0,
      ruleGroup: { logic: "and", conditions: [{ source: "record", field: "tier", operator: "eq", value: "gold" }] },
    },
    { id: "e3", sourceNodeId: "branch", targetNodeId: "end-other", ruleGroup: null, ruleOrder: 99 },
    { id: "e4", sourceNodeId: "action", targetNodeId: "end-gold", ruleGroup: null, ruleOrder: 0 },
  ];
  return { nodes, edges };
}

test("simulateFlow: gold path runs action and reaches Purchased", () => {
  const { nodes, edges } = buildFlow();
  const r = simulateFlow(nodes, edges, { record: { tier: "gold" } });
  assert.equal(r.goal?.label, "Purchased");
  assert.deepEqual(r.fields._tags, ["vip"]);
  assert.deepEqual(r.visited.map((s) => s.nodeId), ["start", "page", "branch", "action", "end-gold"]);
  assert.equal(r.deadEnd, false);
});

test("simulateFlow: non-gold falls back to Declined, no tag", () => {
  const { nodes, edges } = buildFlow();
  const r = simulateFlow(nodes, edges, { record: { tier: "silver" } });
  assert.equal(r.goal?.label, "Declined");
  assert.equal(r.fields._tags, undefined);
});

test("validateFlow: clean flow has no errors", () => {
  const { nodes, edges } = buildFlow();
  const errors = validateFlow(nodes, edges).filter((i) => i.level === "error");
  assert.deepEqual(errors, []);
});

test("validateFlow: catches missing start, end fan-out, action fan-out", () => {
  const nodes: SimNode[] = [
    { id: "p", type: "page", pageId: "p1" },
    { id: "end", type: "end", goalKey: "g" },
  ];
  const edges: SimEdge[] = [
    { id: "e1", sourceNodeId: "end", targetNodeId: "p", ruleGroup: null, ruleOrder: 0 },
  ];
  const codes = validateFlow(nodes, edges).map((i) => i.code);
  assert.ok(codes.includes("no_start"), "flags missing start");
  assert.ok(codes.includes("end_has_outgoing"), "flags end with outgoing edge");
});

test("validateFlow: cycle does not hang the simulator", () => {
  const nodes: SimNode[] = [
    { id: "start", type: "start" },
    { id: "a", type: "branch" },
    { id: "b", type: "branch" },
  ];
  const edges: SimEdge[] = [
    { id: "e0", sourceNodeId: "start", targetNodeId: "a", ruleGroup: null, ruleOrder: 0 },
    { id: "e1", sourceNodeId: "a", targetNodeId: "b", ruleGroup: null, ruleOrder: 0 },
    { id: "e2", sourceNodeId: "b", targetNodeId: "a", ruleGroup: null, ruleOrder: 0 },
  ];
  const r = simulateFlow(nodes, edges, {});
  assert.equal(r.truncated, true);
});
