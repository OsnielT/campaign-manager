// Cross-page "match style" propagation.
//
// Copies the *appearance* props of one component onto every other instance of
// the same type across a campaign's pages. Per-instance content (text, slot
// children, images, icon glyphs, labels, links) is never copied — only visual
// style (colors, spacing, borders, radius, sizes, layout/alignment, etc.).
//
// Shared by the editor (BuilderClient) and the propagate-style API route, so
// both compute the exact same result.

export interface PuckItemLike { type: string; props: Record<string, unknown> }
export interface PuckTreeLike {
  content?: PuckItemLike[];
  zones?: Record<string, PuckItemLike[]>;
  root?: unknown;
}

// Per-instance content / identity props — excluded from propagation.
const CONTENT_KEYS = new Set<string>([
  "id",
  // text content
  "content", "label", "tagline", "brandText", "logoText", "badgeText", "text",
  "placeholder", "description", "alt", "name", "fieldKey", "price", "priceSubtext",
  "title", "buttonLabel", "errorMessage", "alreadyUsedMessage",
  // per-instance identity / semantics
  "icon", "tierLabel", "featuredLabel", "isFeatured", "tierIcon",
  // media + links
  "fontImportUrl", "backgroundImage", "src", "logoUrl", "targetUrl", "successPath", "href",
  // structured content arrays handled separately, listed for clarity
  "items", "fields", "options",
]);

/** The appearance ("style") subset of a component's props. */
export function extractStyle(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props ?? {})) {
    if (CONTENT_KEYS.has(k)) continue;
    if (/url$/i.test(k) || /text$/i.test(k)) continue; // links + any *Text content prop
    if (Array.isArray(v)) continue;                    // slot children
    out[k] = v;
  }
  return out;
}

/**
 * Where a nested component lives, used to scope propagation. A generic type
 * like `Text` is reused across many slots, so matching by type alone would hit
 * unrelated fields. When a scope is given, only items of `type` that sit in the
 * same `slotKey` of the same `parentType` are updated. Top-level / unscoped
 * components (e.g. a Hero or a Step Item) match by type across the campaign.
 */
export interface StyleScope { parentType: string; slotKey: string }

function findItemById(tree: PuckTreeLike, id: string): PuckItemLike | null {
  let found: PuckItemLike | null = null;
  const visit = (item?: PuckItemLike | null) => {
    if (found || !item || typeof item !== "object" || !item.props) return;
    if (item.props.id === id) { found = item; return; }
    for (const v of Object.values(item.props)) {
      if (Array.isArray(v)) v.forEach((c) => visit(c as PuckItemLike));
    }
  };
  (tree.content ?? []).forEach(visit);
  for (const arr of Object.values(tree.zones ?? {})) (arr ?? []).forEach(visit);
  return found;
}

/**
 * Merge `style` into every item of `type` within the tree — including items
 * nested in slot props or DropZones. When `scope` is provided, only items whose
 * immediate container is the same `parentType` + `slotKey` are matched. Mutates
 * `tree`. Returns the number of components updated.
 */
export function applyStyleToTree(
  tree: PuckTreeLike,
  type: string,
  style: Record<string, unknown>,
  scope: StyleScope | null = null
): number {
  let count = 0;
  const visit = (item: PuckItemLike | null | undefined, parentType: string | null, slotKey: string | null) => {
    if (!item || typeof item !== "object" || !item.props) return;
    const inScope = !scope || (parentType === scope.parentType && slotKey === scope.slotKey);
    if (item.type === type && inScope) {
      Object.assign(item.props, style);
      count++;
    }
    // Recurse into slot props (children stored inline as arrays).
    for (const [k, v] of Object.entries(item.props)) {
      if (Array.isArray(v)) v.forEach((c) => visit(c as PuckItemLike, item.type, k));
    }
  };
  // Top-level content has no container.
  (tree.content ?? []).forEach((it) => visit(it, null, null));
  // DropZone children — the zone key is `${parentId}:${slotKey}`.
  for (const [zoneKey, arr] of Object.entries(tree.zones ?? {})) {
    const ci = zoneKey.indexOf(":");
    const parentId = ci >= 0 ? zoneKey.slice(0, ci) : null;
    const slotKey = ci >= 0 ? zoneKey.slice(ci + 1) : null;
    const parent = parentId ? findItemById(tree, parentId) : null;
    (arr ?? []).forEach((it) => visit(it, parent?.type ?? null, slotKey));
  }
  return count;
}
