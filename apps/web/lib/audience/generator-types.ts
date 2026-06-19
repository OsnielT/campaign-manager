// Client-safe generator metadata: the list of generator types, their labels, and
// the inference heuristic. NO faker import here, so this can be used in client
// components (the modal) without bundling faker into the browser. The actual
// value generation lives in lib/audience/generate.ts (server-side).

export const GENERATOR_LABELS = {
  none: "Empty",
  fullName: "Full name",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  company: "Company",
  jobTitle: "Job title",
  city: "City",
  country: "Country",
  streetAddress: "Street address",
  username: "Username",
  word: "Word",
  sentence: "Sentence",
  number: "Number",
  decimal: "Decimal",
  date: "Date",
  boolean: "True / false",
  url: "URL",
  tier: "Tier (gold/silver/bronze)",
} as const;

export type GeneratorType = keyof typeof GENERATOR_LABELS;

export const GENERATOR_KEYS = Object.keys(GENERATOR_LABELS) as GeneratorType[];

export function isGeneratorType(v: unknown): v is GeneratorType {
  return typeof v === "string" && v in GENERATOR_LABELS;
}

export interface AudienceFieldLike {
  key: string;
  label: string;
  type: string; // 'text' | 'number' | 'date'
  generator?: string | null;
  onActivation?: string | null;
}

/** Pick a sensible generator for a field when none is explicitly set. */
export function inferGenerator(field: AudienceFieldLike): GeneratorType {
  const hay = `${field.key} ${field.label}`.toLowerCase();
  const has = (...subs: string[]) => subs.some((s) => hay.includes(s));

  if (has("email")) return "email";
  if (has("first name", "firstname", "first_name")) return "firstName";
  if (has("last name", "lastname", "last_name", "surname")) return "lastName";
  if (has("name")) return "fullName";
  if (has("company", "organization", "organisation", "org", "employer")) return "company";
  if (has("title", "role", "position", "occupation")) return "jobTitle";
  if (has("phone", "mobile", "tel")) return "phone";
  if (has("city", "town")) return "city";
  if (has("country", "nation")) return "country";
  if (has("address", "street")) return "streetAddress";
  if (has("tier", "plan", "level", "membership")) return "tier";
  if (has("user", "handle", "username")) return "username";
  if (has("url", "link", "website")) return "url";
  if (has("date", "_at", "birthday", "dob")) return "date";

  if (field.type === "number") return "number";
  if (field.type === "date") return "date";
  return "word";
}

/** Resolve the effective generator for a field (override → stored → inferred). */
export function resolveGenerator(field: AudienceFieldLike, overrides?: Record<string, string>): GeneratorType {
  const override = overrides?.[field.key];
  if (isGeneratorType(override)) return override;
  if (isGeneratorType(field.generator)) return field.generator;
  return inferGenerator(field);
}
