/**
 * Single source of truth for Stemflow's legal/company details.
 * Edit these values once; they are consumed by legal pages, email footers,
 * and any auto-generated sender identities.
 *
 * PLACEHOLDER — fill in the real values before going live.
 */
export const COMPANY = {
  /** Legal entity name as it appears in filings. */
  legalName: process.env.COMPANY_LEGAL_NAME ?? "Stemflow, Inc.",

  /** Public-facing brand name. */
  brandName: "Stemflow",

  /** Physical postal address required by CAN-SPAM for broadcast email footers. */
  postalAddress: process.env.COMPANY_POSTAL_ADDRESS ?? "123 Main St, Suite 100, Miami, FL 33101, USA",

  /** Governing law jurisdiction for Terms of Service. */
  jurisdiction: process.env.COMPANY_JURISDICTION ?? "State of Florida",

  /** Support email — shown in legal pages and error states. */
  supportEmail: "support@stemflow.dev",

  /** Privacy contact email */
  privacyEmail: "privacy@stemflow.dev",

  /** Effective date of published legal docs. Update when you publish real text. */
  effectiveDate: process.env.LEGAL_EFFECTIVE_DATE ?? "July 1, 2026",

  /** App base URL */
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://stemflow.dev",
} as const;
