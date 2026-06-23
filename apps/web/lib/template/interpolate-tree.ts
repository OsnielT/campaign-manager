import { interpolate, type InterpolationContext } from "./interpolate";

// Strings that look like CSS values or style tokens — skip interpolation on these
// to avoid mangling color codes, dimensions, and class names.
const CSS_SKIP_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|var\(|--.+|[\d.]+(%|px|em|rem|vh|vw|vmin|vmax|pt|ch|ex|fr))$/;

function shouldSkip(s: string): boolean {
  return CSS_SKIP_RE.test(s.trim());
}

function walkValue(value: unknown, ctx: InterpolationContext): unknown {
  if (typeof value === "string") {
    if (shouldSkip(value)) return value;
    return interpolate(value, ctx);
  }
  if (Array.isArray(value)) {
    return value.map((item) => walkValue(item, ctx));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walkValue(v, ctx);
    }
    return out;
  }
  return value;
}

/**
 * Deep-walk a Puck composition tree (or any plain JSON) and run
 * interpolate() on every string leaf that isn't a CSS/style token.
 * Returns a new object — does not mutate the input.
 */
export function interpolateTree(tree: unknown, ctx: InterpolationContext): unknown {
  return walkValue(tree, ctx);
}
