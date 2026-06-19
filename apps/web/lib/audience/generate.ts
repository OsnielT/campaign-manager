// Server-side test-data generation, backed by @faker-js/faker. Generator-type
// metadata + inference live in ./generator-types (client-safe, no faker).

import { faker } from "@faker-js/faker";
import {
  resolveGenerator,
  type AudienceFieldLike,
  type GeneratorType,
} from "@/lib/audience/generator-types";

export {
  GENERATOR_LABELS,
  GENERATOR_KEYS,
  isGeneratorType,
  inferGenerator,
  resolveGenerator,
  type GeneratorType,
  type AudienceFieldLike,
} from "@/lib/audience/generator-types";

const TIERS = ["gold", "silver", "bronze"];

/** Value generators keyed by generator type. */
const GEN: Record<GeneratorType, () => string | number> = {
  none: () => "",
  fullName: () => faker.person.fullName(),
  firstName: () => faker.person.firstName(),
  lastName: () => faker.person.lastName(),
  email: () => faker.internet.email().toLowerCase(),
  phone: () => faker.phone.number(),
  company: () => faker.company.name(),
  jobTitle: () => faker.person.jobTitle(),
  city: () => faker.location.city(),
  country: () => faker.location.country(),
  streetAddress: () => faker.location.streetAddress(),
  username: () => faker.internet.username().toLowerCase(),
  word: () => faker.word.sample(),
  sentence: () => faker.lorem.sentence(),
  number: () => faker.number.int({ min: 1, max: 1000 }),
  decimal: () => faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }),
  date: () => faker.date.past({ years: 2 }).toISOString().slice(0, 10),
  boolean: () => (faker.datatype.boolean() ? "true" : "false"),
  url: () => faker.internet.url(),
  tier: () => faker.helpers.arrayElement(TIERS),
};

export interface GeneratedRecord {
  name: string;
  email: string;
  fields: Record<string, unknown>;
}

/**
 * Build values for one fake record. Always produces a name + email (top-level
 * columns) so generated data works with email broadcasts; each custom field is
 * filled via its resolved generator. Activation-managed fields are left blank
 * (mirrors CSV import) so activation detection still works.
 */
export function generateRecordValues(
  fields: AudienceFieldLike[],
  overrides?: Record<string, string>,
): GeneratedRecord {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const name = `${firstName} ${lastName}`;
  const email = faker.internet.email({ firstName, lastName }).toLowerCase();

  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.onActivation) {
      out[f.key] = ""; // system-managed; set on activation
      continue;
    }
    const g = resolveGenerator(f, overrides);
    // Reuse the record's identity for obvious name/email fields so they're consistent.
    if (g === "fullName") out[f.key] = name;
    else if (g === "firstName") out[f.key] = firstName;
    else if (g === "lastName") out[f.key] = lastName;
    else if (g === "email") out[f.key] = email;
    else out[f.key] = GEN[g]();
  }

  return { name, email, fields: out };
}
