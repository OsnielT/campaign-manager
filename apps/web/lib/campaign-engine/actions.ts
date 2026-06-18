/**
 * Pure flow-action engine — no DB calls, fully unit-testable.
 *
 * Action nodes run an ordered list of FlowActions when a visitor reaches them.
 * Actions mutate the visitor's audience-record `fields` (and a `_tags` array
 * within those fields), so the values the flow sets are what later gets exported.
 *
 * `applyActions` is pure: it takes the current fields + a read context and
 * returns the patch to merge. The caller persists the patch via
 * `patchAudienceRecordFields` (see session.ts).
 */

import type { SessionContext } from "./branch";

export type ActionSource = "form" | "url" | "record" | "context";

export type FlowAction =
  | { op: "set"; field: string; value: string }
  | { op: "copy"; field: string; from: { source: ActionSource; key: string } }
  | { op: "compute"; field: string; expr: "increment" | "sum" | "concat"; args: string[] }
  | { op: "tag"; add?: string[]; remove?: string[] };

const TAGS_FIELD = "_tags";

function readSource(
  ctx: SessionContext,
  source: ActionSource,
  key: string
): unknown {
  switch (source) {
    case "form":
      return ctx.form[key];
    case "url":
      return ctx.url[key];
    case "record":
      return ctx.record?.[key];
    case "context":
      return ctx.context?.[key];
    default:
      return undefined;
  }
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function readTags(fields: Record<string, unknown>): string[] {
  const raw = fields[TAGS_FIELD];
  return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === "string") : [];
}

/**
 * Apply an ordered list of actions against the current record fields + context.
 * Returns a `{ patch, tags }` result: `patch` is the set of changed keys to
 * merge into the record's `fields` JSONB. `tags` is included in the patch under
 * `_tags` when any tag op ran. Pure — does not mutate its inputs.
 */
export function applyActions(
  actions: FlowAction[],
  ctx: SessionContext
): { patch: Record<string, unknown> } {
  // Working copy of fields so later actions can read values set by earlier ones.
  const working: Record<string, unknown> = { ...(ctx.record ?? {}) };
  const patch: Record<string, unknown> = {};
  let tagsTouched = false;
  let tags = readTags(working);

  const localCtx: SessionContext = { ...ctx, record: working };

  for (const action of actions) {
    switch (action.op) {
      case "set": {
        working[action.field] = action.value;
        patch[action.field] = action.value;
        break;
      }
      case "copy": {
        const v = readSource(localCtx, action.from.source, action.from.key);
        if (v !== undefined && v !== null) {
          const sv = String(v);
          working[action.field] = sv;
          patch[action.field] = sv;
        }
        break;
      }
      case "compute": {
        let result: string | number;
        if (action.expr === "increment") {
          result = toNumber(working[action.field]) + 1;
        } else if (action.expr === "sum") {
          result = action.args.reduce((acc, key) => acc + toNumber(working[key]), 0);
        } else {
          // concat
          result = action.args.map((key) => String(working[key] ?? "")).join("");
        }
        working[action.field] = result;
        patch[action.field] = result;
        break;
      }
      case "tag": {
        tagsTouched = true;
        if (action.add) {
          for (const t of action.add) {
            if (!tags.includes(t)) tags = [...tags, t];
          }
        }
        if (action.remove) {
          tags = tags.filter((t) => !action.remove!.includes(t));
        }
        break;
      }
    }
  }

  if (tagsTouched) patch[TAGS_FIELD] = tags;

  return { patch };
}

/** Type guard for a persisted actions blob from the DB. */
export function parseActions(raw: unknown): FlowAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is FlowAction =>
      Boolean(a) && typeof a === "object" && typeof (a as { op?: unknown }).op === "string"
  );
}
