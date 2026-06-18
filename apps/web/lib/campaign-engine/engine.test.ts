/**
 * Pure-engine unit tests. No DB — run with:
 *   npx tsx --test lib/campaign-engine/engine.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateBranchNode, type SessionContext, type FlowEdge } from "./branch";
import { applyActions, type FlowAction } from "./actions";

function ctx(over: Partial<SessionContext> = {}): SessionContext {
  return { form: {}, url: {}, record: null, ...over };
}

test("record-source condition now routes (the previously-severed connection)", () => {
  const edges: FlowEdge[] = [
    {
      id: "e1",
      targetNodeId: "gold-page",
      ruleOrder: 0,
      ruleGroup: {
        logic: "and",
        conditions: [{ source: "record", field: "tier", operator: "eq", value: "gold" }],
      },
    },
    { id: "e2", targetNodeId: "default-page", ruleOrder: 99, ruleGroup: null },
  ];

  const gold = evaluateBranchNode(edges, ctx({ record: { tier: "gold" } }));
  assert.equal(gold, "gold-page");

  const other = evaluateBranchNode(edges, ctx({ record: { tier: "silver" } }));
  assert.equal(other, "default-page", "non-matching record falls back");

  const noRecord = evaluateBranchNode(edges, ctx({ record: null }));
  assert.equal(noRecord, "default-page", "null record falls back, does not throw");
});

test("cross-source AND/OR evaluation", () => {
  const edges: FlowEdge[] = [
    {
      id: "e1",
      targetNodeId: "vip",
      ruleOrder: 0,
      ruleGroup: {
        logic: "and",
        conditions: [
          { source: "record", field: "tier", operator: "eq", value: "gold" },
          { source: "form", field: "qty", operator: "gte", value: 5 },
        ],
      },
    },
    { id: "e2", targetNodeId: "fallback", ruleOrder: 10, ruleGroup: null },
  ];
  assert.equal(
    evaluateBranchNode(edges, ctx({ record: { tier: "gold" }, form: { qty: "6" } })),
    "vip"
  );
  assert.equal(
    evaluateBranchNode(edges, ctx({ record: { tier: "gold" }, form: { qty: "2" } })),
    "fallback"
  );
});

test("applyActions: set, copy, compute, tag", () => {
  const actions: FlowAction[] = [
    { op: "set", field: "qualified", value: "true" },
    { op: "copy", field: "from_email", from: { source: "form", key: "email" } },
    { op: "compute", field: "visits", expr: "increment", args: [] },
    { op: "tag", add: ["vip"] },
  ];
  const { patch } = applyActions(
    actions,
    ctx({ form: { email: "a@b.com" }, record: { visits: 2, _tags: ["existing"] } })
  );
  assert.equal(patch.qualified, "true");
  assert.equal(patch.from_email, "a@b.com");
  assert.equal(patch.visits, 3, "increment reads existing record value");
  assert.deepEqual(patch._tags, ["existing", "vip"], "tags merge, no duplicates");
});

test("applyActions: later actions read earlier ones (sum)", () => {
  const actions: FlowAction[] = [
    { op: "set", field: "a", value: "10" },
    { op: "set", field: "b", value: "5" },
    { op: "compute", field: "total", expr: "sum", args: ["a", "b"] },
  ];
  const { patch } = applyActions(actions, ctx());
  assert.equal(patch.total, 15);
});

test("applyActions: tag remove", () => {
  const { patch } = applyActions(
    [{ op: "tag", remove: ["old"] }],
    ctx({ record: { _tags: ["old", "keep"] } })
  );
  assert.deepEqual(patch._tags, ["keep"]);
});
