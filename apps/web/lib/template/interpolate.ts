/**
 * Template variable interpolation engine.
 *
 * Syntax:  {{source.field}}  or shorthand  {{field}}
 * Transforms (pipe-separated keywords): capitalize, uppercase, lowercase
 * Fallback: last non-keyword pipe segment  →  {{record.name|capitalize|Friend}}
 */

export interface InterpolationContext {
  record: Record<string, unknown> | null;
  form:   Record<string, unknown>;
  url:    Record<string, string>;
  context: Record<string, unknown>;
}

const TRANSFORMS = new Set(["capitalize", "uppercase", "lowercase"]);

const TOKEN_RE = /\{\{([^}]+)\}\}/g;

function applyTransform(value: string, transform: string): string {
  if (transform === "capitalize") return value.charAt(0).toUpperCase() + value.slice(1);
  if (transform === "uppercase")  return value.toUpperCase();
  if (transform === "lowercase")  return value.toLowerCase();
  return value;
}

function resolveValue(source: string, field: string, ctx: InterpolationContext): string | undefined {
  let raw: unknown;
  if (source === "record") {
    if (!ctx.record) return undefined;
    // Support top-level name/email too
    raw = (ctx.record as Record<string, unknown>)[field] ?? (ctx.record.fields as Record<string, unknown> | undefined)?.[field];
  } else if (source === "form") {
    raw = ctx.form[field];
  } else if (source === "url") {
    raw = ctx.url[field];
  } else if (source === "context") {
    raw = ctx.context[field];
  }
  if (raw === null || raw === undefined) return undefined;
  return String(raw);
}

export function interpolate(template: string, ctx: InterpolationContext): string {
  return template.replace(TOKEN_RE, (_match, inner: string) => {
    const parts = inner.trim().split("|");
    const spec = parts[0].trim();

    // Parse source.field vs shorthand field
    let source: string;
    let field: string;
    if (spec.includes(".")) {
      const dot = spec.indexOf(".");
      source = spec.slice(0, dot);
      field  = spec.slice(dot + 1);
    } else {
      // Shorthand: try record first, then form
      field  = spec;
      source = "__shorthand__";
    }

    // Collect transforms and fallback from remaining pipe segments
    let fallback: string | undefined;
    const transforms: string[] = [];
    for (let i = 1; i < parts.length; i++) {
      const seg = parts[i].trim();
      if (TRANSFORMS.has(seg)) transforms.push(seg);
      else fallback = seg;
    }

    // Resolve value
    let value: string | undefined;
    if (source === "__shorthand__") {
      value = resolveValue("record", field, ctx) ?? resolveValue("form", field, ctx);
    } else {
      value = resolveValue(source, field, ctx);
    }

    if (value === undefined || value === "") {
      return fallback ?? "";
    }

    for (const t of transforms) {
      value = applyTransform(value, t);
    }
    return value;
  });
}

export interface ParsedToken {
  raw: string;       // e.g. "{{record.first_name|capitalize}}"
  source: string;    // "record" | "form" | "url" | "context" | "shorthand"
  field: string;
  transforms: string[];
  fallback?: string;
}

export function extractTokens(template: string): ParsedToken[] {
  const tokens: ParsedToken[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE.source, "g");
  while ((m = re.exec(template)) !== null) {
    const inner = m[1].trim();
    const parts = inner.split("|");
    const spec = parts[0].trim();

    let source: string;
    let field: string;
    if (spec.includes(".")) {
      const dot = spec.indexOf(".");
      source = spec.slice(0, dot);
      field  = spec.slice(dot + 1);
    } else {
      source = "shorthand";
      field  = spec;
    }

    let fallback: string | undefined;
    const transforms: string[] = [];
    for (let i = 1; i < parts.length; i++) {
      const seg = parts[i].trim();
      if (TRANSFORMS.has(seg)) transforms.push(seg);
      else fallback = seg;
    }

    tokens.push({ raw: m[0], source, field, transforms, fallback });
  }
  return tokens;
}

/**
 * Build an InterpolationContext from a readSession() result.
 * The session object matches the Drizzle query result shape.
 */
export function buildInterpolationContext(
  session: {
    formData: Record<string, unknown>;
    urlParams: Record<string, unknown>;
    context: Record<string, unknown>;
    audienceRecord: { name: string | null; email: string | null; fields: Record<string, unknown> } | null;
  } | null
): InterpolationContext {
  if (!session) {
    return { record: null, form: {}, url: {}, context: {} };
  }

  const ar = session.audienceRecord;
  const record: Record<string, unknown> | null = ar
    ? {
        ...(ar.fields as Record<string, unknown>),
        // Expose top-level name/email as record.name and record.email
        ...(ar.name  ? { name:  ar.name }  : {}),
        ...(ar.email ? { email: ar.email } : {}),
      }
    : null;

  return {
    record,
    form:    (session.formData    as Record<string, unknown>) ?? {},
    url:     (session.urlParams   as Record<string, string>)  ?? {},
    context: (session.context     as Record<string, unknown>) ?? {},
  };
}

/**
 * Build a dummy InterpolationContext from seed-field generators,
 * used for editor preview mode and the preview route.
 */
export function buildDummyContext(
  generators: Record<string, () => string>
): InterpolationContext {
  const record: Record<string, unknown> = {};
  for (const [key, gen] of Object.entries(generators)) {
    try { record[key] = gen(); } catch { record[key] = ""; }
  }
  return {
    record,
    form:    { email: "jane@example.com", company: "Acme Inc." },
    url:     { ref: "homepage", coupon: "WELCOME20" },
    context: { city: "New York", country: "US", device: "desktop" },
  };
}
