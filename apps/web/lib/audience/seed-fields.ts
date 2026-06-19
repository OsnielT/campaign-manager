// Per-template starter audience fields. When a campaign is created from a
// built-in template it arrives with a sensible field set (with generator types
// preconfigured) so "Generate test data" works immediately.

export interface SeedField {
  key: string;
  label: string;
  type: "text" | "number" | "date";
  position: number;
  generator: string; // GeneratorType from lib/audience/generate.ts
  required?: boolean;
}

function fields(...specs: Omit<SeedField, "position">[]): SeedField[] {
  return specs.map((s, i) => ({ position: i, required: false, ...s }));
}

const NAME: Omit<SeedField, "position"> = { key: "name", label: "Name", type: "text", generator: "fullName" };
const EMAIL: Omit<SeedField, "position"> = { key: "email", label: "Email", type: "text", generator: "email" };

const BY_TEMPLATE: Record<string, SeedField[]> = {
  "lead-capture": fields(NAME, EMAIL, { key: "company", label: "Company", type: "text", generator: "company" }),
  "b2b-demo": fields(NAME, EMAIL, { key: "company", label: "Company", type: "text", generator: "company" }, { key: "job_title", label: "Job title", type: "text", generator: "jobTitle" }),
  webinar: fields(NAME, EMAIL, { key: "job_title", label: "Job title", type: "text", generator: "jobTitle" }),
  activation: fields(NAME, EMAIL, { key: "tier", label: "Tier", type: "text", generator: "tier" }),
  "vip-access": fields(NAME, EMAIL, { key: "tier", label: "Tier", type: "text", generator: "tier" }),
  "multi-offer": fields(NAME, EMAIL, { key: "city", label: "City", type: "text", generator: "city" }),
  "fitness-quiz": fields(NAME, EMAIL),
  blank: fields(NAME, EMAIL),
};

/** Standard audience fields for a built-in template (defaults to name + email). */
export function audienceFieldsFor(templateId: string): SeedField[] {
  return BY_TEMPLATE[templateId] ?? fields(NAME, EMAIL);
}
