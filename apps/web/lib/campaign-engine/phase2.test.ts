/**
 * Phase 2 engine tests: context/time sources, field refs, nested groups, A/B split.
 *   npx tsx --test lib/campaign-engine/phase2.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateBranchNode,
  pickWeightedEdge,
  hashToUnit,
  type SessionContext,
  type FlowEdge,
} from "./branch";
import { simulateFlow, type SimNode, type SimEdge } from "./simulate";

function ctx(over: Partial<SessionContext> = {}): SessionContext {
  return { form: {}, url: {}, record: null, ...over };
}

test("context source routes on device/geo", () => {
  const edges: FlowEdge[] = [
    {
      id: "e1", targetNodeId: "mobile-page", ruleOrder: 0,
      ruleGroup: { logic: "and", conditions: [{ source: "context", field: "device", operator: "eq", value: "mobile" }] },
    },
    { id: "e2", targetNodeId: "default", ruleOrder: 9, ruleGroup: null },
  ];
  assert.equal(evaluateBranchNode(edges, ctx({ context: { device: "mobile" } })), "mobile-page");
  assert.equal(evaluateBranchNode(edges, ctx({ context: { device: "desktop" } })), "default");
});

test("time source: hour and elapsed", () => {
  const noon = Date.UTC(2026, 0, 1, 12, 0, 0);
  const edges: FlowEdge[] = [
    {
      id: "e1", targetNodeId: "afternoon", ruleOrder: 0,
      ruleGroup: { logic: "and", conditions: [{ source: "time", field: "hour", operator: "gte", value: 12 }] },
    },
    { id: "e2", targetNodeId: "morning", ruleOrder: 9, ruleGroup: null },
  ];
  assert.equal(evaluateBranchNode(edges, ctx({ now: noon })), "afternoon");

  const elapsedEdges: FlowEdge[] = [
    {
      id: "e1", targetNodeId: "stale", ruleOrder: 0,
      ruleGroup: { logic: "and", conditions: [{ source: "time", field: "elapsed", operator: "gt", value: 3600 }] },
    },
    { id: "e2", targetNodeId: "fresh", ruleOrder: 9, ruleGroup: null },
  ];
  assert.equal(
    evaluateBranchNode(elapsedEdges, ctx({ now: noon, sessionStart: noon - 7200 * 1000 })),
    "stale"
  );
  assert.equal(
    evaluateBranchNode(elapsedEdges, ctx({ now: noon, sessionStart: noon - 60 * 1000 })),
    "fresh"
  );
});

test("field-reference value: compare two fields", () => {
  const edges: FlowEdge[] = [
    {
      id: "e1", targetNodeId: "match", ruleOrder: 0,
      ruleGroup: {
        logic: "and",
        conditions: [{ source: "form", field: "email", operator: "eq", value: { ref: { source: "record", field: "email" } } }],
      },
    },
    { id: "e2", targetNodeId: "mismatch", ruleOrder: 9, ruleGroup: null },
  ];
  assert.equal(
    evaluateBranchNode(edges, ctx({ form: { email: "a@b.com" }, record: { email: "a@b.com" } })),
    "match"
  );
  assert.equal(
    evaluateBranchNode(edges, ctx({ form: { email: "x@y.com" }, record: { email: "a@b.com" } })),
    "mismatch"
  );
});

test("nested rule groups: A AND (B OR C)", () => {
  const edges: FlowEdge[] = [
    {
      id: "e1", targetNodeId: "yes", ruleOrder: 0,
      ruleGroup: {
        logic: "and",
        conditions: [
          { source: "record", field: "tier", operator: "eq", value: "gold" },
          {
            logic: "or",
            conditions: [
              { source: "form", field: "qty", operator: "gte", value: 5 },
              { source: "context", field: "country", operator: "eq", value: "US" },
            ],
          },
        ],
      },
    },
    { id: "e2", targetNodeId: "no", ruleOrder: 9, ruleGroup: null },
  ];
  assert.equal(evaluateBranchNode(edges, ctx({ record: { tier: "gold" }, form: { qty: "6" } })), "yes");
  assert.equal(evaluateBranchNode(edges, ctx({ record: { tier: "gold" }, context: { country: "US" }, form: { qty: "1" } })), "yes");
  assert.equal(evaluateBranchNode(edges, ctx({ record: { tier: "gold" }, form: { qty: "1" }, context: { country: "CA" } })), "no");
  assert.equal(evaluateBranchNode(edges, ctx({ record: { tier: "silver" }, form: { qty: "9" } })), "no");
});

test("pickWeightedEdge: respects weights and is sticky per seed", () => {
  const edges = [
    { targetNodeId: "A", weight: 1, ruleOrder: 0 },
    { targetNodeId: "B", weight: 3, ruleOrder: 1 },
  ];
  // unit 0.1 → within A's first 25%; unit 0.9 → in B's region
  assert.equal(pickWeightedEdge(edges, 0.1), "A");
  assert.equal(pickWeightedEdge(edges, 0.9), "B");

  // Sticky: same seed → same arm every time.
  const u = hashToUnit("visitor-token-123" + "split-node");
  assert.equal(pickWeightedEdge(edges, u), pickWeightedEdge(edges, u));

  // Roughly respects a 1:3 split over many seeds.
  let bCount = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) {
    if (pickWeightedEdge(edges, hashToUnit("v" + i)) === "B") bCount++;
  }
  const ratio = bCount / N;
  assert.ok(ratio > 0.65 && ratio < 0.85, `B share ~0.75, got ${ratio.toFixed(3)}`);
});

test("simulateFlow: split node sticky-buckets a visitor", () => {
  const nodes: SimNode[] = [
    { id: "start", type: "start" },
    { id: "split", type: "branch", config: { mode: "split" } },
    { id: "endA", type: "end", goalKey: "a", goalLabel: "A" },
    { id: "endB", type: "end", goalKey: "b", goalLabel: "B" },
  ];
  const edges: SimEdge[] = [
    { id: "e0", sourceNodeId: "start", targetNodeId: "split", ruleGroup: null, ruleOrder: 0 },
    { id: "e1", sourceNodeId: "split", targetNodeId: "endA", ruleGroup: null, ruleOrder: 0, weight: 1 },
    { id: "e2", sourceNodeId: "split", targetNodeId: "endB", ruleGroup: null, ruleOrder: 1, weight: 1 },
  ];
  const r1 = simulateFlow(nodes, edges, { seed: "visitor-1" });
  const r2 = simulateFlow(nodes, edges, { seed: "visitor-1" });
  assert.equal(r1.goal?.label, r2.goal?.label, "same seed → same arm");
  assert.ok(["A", "B"].includes(r1.goal?.label ?? ""));
});
