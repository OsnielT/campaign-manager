import postgres from "postgres";

const sql = postgres("postgresql://primitive:primitive@localhost:5433/primitive?sslmode=disable");

const PAGE_IDS = {
  gateway:   "c08387c8-aad9-4819-8298-084a13e5014d", // /
  offerA:    "8d3be13b-4283-42c8-954f-54db55d0e2d3", // /offer-a
  offerB:    "81781f4c-b456-4756-bd19-c96c307caba9", // /offer-b
  confirmed: "cbe112f5-6f1c-4625-85e8-778884082fc7", // /confirmed
  product:   "b3185f9a-6052-47d0-855d-f10514a139da", // /product
};

const FONT_URL = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap";
const GOLD = "#e8b84b";
const BG   = "#07071a";

// Shared nav used on every page
const nav = (badge) => ({
  type: "CampaignNav",
  props: {
    id: "nav",
    logoText: "VELERA",
    badgeText: badge,
    fontImportUrl: FONT_URL,
    background: "rgba(7,7,26,0.95)",
    borderColor: "rgba(232,184,75,0.18)",
    logoColor: GOLD,
    logotype: "serif",
    logoLetterSpacing: "5px",
    badgeBackground: "rgba(232,184,75,0.1)",
    badgeTextColor: GOLD,
  },
});

// ─── Gateway — Select Your Access ─────────────────────────────────────────────

const gatewayId = {
  grid: "gw-grid",
  tierI: "gw-tier-1",
  tierII: "gw-tier-2",
  divider: "gw-divider",
  wrap: "gw-wrap",
};

const gatewayComposition = {
  root: { props: { title: "Select Your Access — Velera", backgroundColor: BG } },
  content: [
    nav("December Launch"),
    {
      type: "SectionWrap",
      props: {
        id: "gw-hero-wrap",
        maxWidth: "680px",
        paddingTop: "56px",
        paddingBottom: "40px",
        paddingX: "24px",
        centered: true,
      },
    },
    {
      type: "SectionWrap",
      props: {
        id: gatewayId.wrap,
        maxWidth: "760px",
        paddingTop: "0",
        paddingBottom: "48px",
        paddingX: "24px",
        centered: true,
      },
    },
    {
      type: "audience-lookup",
      props: {
        id: "gw-lookup",
        label: "Invitation Code",
        buttonLabel: "Continue →",
        placeholder: "e.g. 534978",
        successPath: "",
        errorMessage: "That code wasn't found. Check your invitation email and try again.",
        alreadyUsedMessage: "This code has already been used. Check your inbox for your access details.",
        identifyOnly: true,
      },
    },
    {
      type: "BrandFooter",
      props: {
        id: "gw-footer",
        brandText: "VELERA",
        tagline: "Your access tier is determined by your invitation code. Questions? support@velera.io",
        brandFont: "serif",
        brandColor: GOLD,
        background: BG,
        paddingY: "24px",
      },
    },
  ],
  zones: {
    "gw-hero-wrap:children": [
      {
        type: "Text",
        props: {
          id: "gw-eyebrow",
          content: "✦  Exclusive — December 2025",
          as: "p",
          size: "sm",
          tone: "primary",
          textAlign: "center",
          color: GOLD,
          fontSize: "11px",
          customCss: `letter-spacing:0.18em; text-transform:uppercase; font-weight:600; margin-bottom:20px; display:inline-block; padding:5px 16px; background:rgba(232,184,75,0.1); border:1px solid rgba(232,184,75,0.25); border-radius:999px;`,
        },
      },
      {
        type: "Text",
        props: {
          id: "gw-headline",
          content: "Choose Your Access Level",
          as: "h1",
          size: "lg",
          tone: "primary",
          textAlign: "center",
          color: "#ffffff",
          fontSize: "clamp(34px,5vw,56px)",
          customCss: `font-family:'Cormorant Garamond',Georgia,serif; font-weight:700; line-height:1.1; letter-spacing:-0.02em; margin-bottom:16px;`,
        },
      },
      {
        type: "Text",
        props: {
          id: "gw-sub",
          content: "You've been invited to join Velera as part of our December launch cohort. Select the access tier that fits your needs — both are complimentary for a limited time.",
          as: "p",
          size: "md",
          tone: "secondary",
          textAlign: "center",
          fontSize: "15px",
          customCss: `line-height:1.7; max-width:480px; margin:0 auto; font-family:'DM Sans',sans-serif;`,
        },
      },
    ],
    [`${gatewayId.wrap}:children`]: [
      {
        type: "TierGrid",
        props: { id: gatewayId.grid, columns: "2", gap: "20px" },
      },
      {
        type: "Divider",
        props: {
          id: gatewayId.divider,
          label: "Enter your invite code to continue",
          labelColor: "rgba(232,232,240,0.4)",
          lineColor: "rgba(255,255,255,0.08)",
          paddingY: "36px",
        },
      },
    ],
    [`${gatewayId.grid}:children`]: [
      {
        type: "TierCard",
        props: {
          id: gatewayId.tierI,
          tierLabel: "Tier I",
          tierIcon: "circle",
          accentColor: GOLD,
          title: "Starter",
          titleFont: "serif",
          price: "90 Days Free",
          priceSubtext: "No credit card required",
          features: [
            { text: "Core analytics dashboard" },
            { text: "Up to 5 active campaigns" },
            { text: "Priority email support" },
            { text: "Onboarding call included" },
          ],
          footerLeft: "Offer expires Dec 31, 2025",
          footerRight: "Invite-only",
          ctaLabel: "Select Tier I →",
          ctaUrl: "?product=1#gw-lookup",
          featuredLabel: "",
          topLine: "left",
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(255,255,255,0.08)",
          isFeatured: false,
        },
      },
      {
        type: "TierCard",
        props: {
          id: gatewayId.tierII,
          tierLabel: "Tier II · Premium",
          tierIcon: "star",
          accentColor: GOLD,
          title: "Plus",
          titleFont: "serif",
          price: "6 Months Free",
          priceSubtext: "Everything in Starter, plus our full suite",
          features: [
            { text: "Everything in Starter (Tier I)" },
            { text: "Advanced reporting & AI insights" },
            { text: "Unlimited active campaigns" },
            { text: "Custom integrations & API access" },
            { text: "Dedicated success manager" },
          ],
          footerLeft: "Offer expires Dec 31, 2025",
          footerRight: "★ Premium tier",
          ctaLabel: "Select Tier II →",
          ctaUrl: "?product=2#gw-lookup",
          featuredLabel: "★ Most popular",
          topLine: "center",
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(232,184,75,0.3)",
          isFeatured: true,
        },
      },
    ],
  },
};

// ─── Offer A — Tier I ─────────────────────────────────────────────────────────

const offerAComposition = {
  root: { props: { title: "Offer A — Tier I Access", backgroundColor: BG } },
  content: [
    nav("December Launch"),
    {
      type: "Hero",
      props: {
        id: "oa-hero",
        backgroundImage: "https://picsum.photos/seed/velera-winter-a/1400/500",
        imageFilter: "brightness(0.35) saturate(0.6)",
        overlayGradient: "diagonal",
        eyebrow: "Tier I Access — Exclusive Invite",
        eyebrowColor: GOLD,
        headline: "Your Offer\nIs Ready.",
        headlineFont: "serif",
        headlineFontSize: "clamp(36px,5vw,60px)",
        subheadline: "You've been hand-selected for complimentary access to Velera's full platform — no commitment required.",
        height: "340px",
        contentPosition: "bottom-left",
        paddingLeft: "56px",
        paddingBottom: "48px",
      },
    },
    {
      type: "SectionWrap",
      props: {
        id: "oa-wrap",
        maxWidth: "680px",
        paddingTop: "52px",
        paddingBottom: "80px",
        paddingX: "24px",
        centered: true,
      },
    },
  ],
  zones: {
    "oa-wrap:children": [
      {
        type: "TierCard",
        props: {
          id: "oa-card",
          tierLabel: "Starter Access · Tier I",
          tierIcon: "circle",
          accentColor: GOLD,
          title: "90 Days Free",
          titleFont: "serif",
          price: "",
          priceSubtext: "Full platform access, no credit card required",
          features: [
            { text: "Core analytics dashboard" },
            { text: "Up to 5 active campaigns" },
            { text: "Priority email support" },
            { text: "Onboarding call with your account manager" },
          ],
          footerLeft: "Offer expires Dec 31, 2025",
          footerRight: "Invite-only",
          featuredLabel: "",
          topLine: "left",
          background: "rgba(255,255,255,0.035)",
          borderColor: "rgba(255,255,255,0.08)",
          isFeatured: false,
        },
      },
      {
        type: "Text",
        props: {
          id: "oa-hint",
          content: "Click below to confirm your offer and proceed to activation. Your access code will be requested on the next step.",
          as: "p",
          size: "sm",
          tone: "secondary",
          textAlign: "center",
          customCss: `margin-top:20px; line-height:1.6; font-family:'DM Sans',sans-serif;`,
        },
      },
      {
        type: "campaign-conversion-button",
        props: {
          id: "oa-cta",
          label: "Confirm My Offer →",
          navigateTo: "next",
          targetUrl: "",
        },
      },
    ],
  },
};

// ─── Offer B — Tier II ────────────────────────────────────────────────────────

const offerBComposition = {
  root: { props: { title: "Offer B — Tier II Access", backgroundColor: BG } },
  content: [
    nav("December Launch"),
    {
      type: "Hero",
      props: {
        id: "ob-hero",
        backgroundImage: "https://picsum.photos/seed/velera-winter-b/1400/500",
        imageFilter: "brightness(0.3) saturate(0.5) hue-rotate(200deg)",
        overlayGradient: "diagonal",
        eyebrow: "Tier II Access — Premium Invite",
        eyebrowColor: GOLD,
        headline: "Your Premium\nAccess Awaits.",
        headlineFont: "serif",
        headlineFontSize: "clamp(36px,5vw,60px)",
        subheadline: "As a Tier II member, you've been selected for our most comprehensive package — reserved for our top-tier partners.",
        height: "340px",
        contentPosition: "bottom-left",
        paddingLeft: "56px",
        paddingBottom: "48px",
      },
    },
    {
      type: "SectionWrap",
      props: {
        id: "ob-wrap",
        maxWidth: "680px",
        paddingTop: "52px",
        paddingBottom: "80px",
        paddingX: "24px",
        centered: true,
      },
    },
  ],
  zones: {
    "ob-wrap:children": [
      {
        type: "TierCard",
        props: {
          id: "ob-card",
          tierLabel: "Plus Access · Tier II",
          tierIcon: "star",
          accentColor: GOLD,
          title: "6 Months Free",
          titleFont: "serif",
          price: "",
          priceSubtext: "Everything in Tier I, plus our premium suite",
          features: [
            { text: "Everything in Starter (Tier I)" },
            { text: "Advanced reporting & AI insights" },
            { text: "Unlimited active campaigns" },
            { text: "Custom integrations & API access" },
            { text: "Dedicated success manager" },
            { text: "White-glove onboarding session" },
          ],
          footerLeft: "Offer expires Dec 31, 2025",
          footerRight: "★ Premium tier",
          featuredLabel: "",
          topLine: "center",
          background: "rgba(255,255,255,0.035)",
          borderColor: "rgba(232,184,75,0.3)",
          isFeatured: true,
        },
      },
      {
        type: "Text",
        props: {
          id: "ob-hint",
          content: "Click below to confirm your offer and proceed to activation. Your access code will be requested on the next step.",
          as: "p",
          size: "sm",
          tone: "secondary",
          textAlign: "center",
          customCss: `margin-top:20px; line-height:1.6; font-family:'DM Sans',sans-serif;`,
        },
      },
      {
        type: "campaign-conversion-button",
        props: {
          id: "ob-cta",
          label: "Confirm My Premium Offer →",
          navigateTo: "next",
          targetUrl: "",
        },
      },
    ],
  },
};

// ─── Product — Activate Your Access ───────────────────────────────────────────

const productComposition = {
  root: { props: { title: "Activate Your Access", backgroundColor: BG } },
  content: [
    nav("Activate Your Access"),
    {
      type: "SectionWrap",
      props: {
        id: "pr-wrap",
        maxWidth: "520px",
        paddingTop: "64px",
        paddingBottom: "40px",
        paddingX: "24px",
        centered: true,
      },
    },
    {
      type: "audience-lookup",
      props: {
        id: "pr-lookup",
        label: "Access Code",
        buttonLabel: "Activate",
        placeholder: "e.g. 534978",
        successPath: "/confirmed",
        errorMessage: "That code wasn't found. Double-check your invitation and try again.",
        alreadyUsedMessage: "You've already activated your offer. Check your inbox for next steps.",
        identifyOnly: false,
      },
    },
    {
      type: "BrandFooter",
      props: {
        id: "pr-footer",
        brandText: "",
        tagline: "Having trouble? Contact support@velera.io with your invite ID.",
        brandFont: "serif",
        brandColor: GOLD,
        background: BG,
        paddingY: "16px",
        customCss: "color:rgba(232,232,240,0.3);",
      },
    },
  ],
  zones: {
    "pr-wrap:children": [
      {
        type: "Text",
        props: {
          id: "pr-icon-hint",
          content: "🔒",
          as: "p",
          size: "lg",
          tone: "primary",
          textAlign: "center",
          fontSize: "28px",
          customCss: `margin-bottom:16px; display:block;`,
        },
      },
      {
        type: "Text",
        props: {
          id: "pr-headline",
          content: "Activate Your Access",
          as: "h1",
          size: "lg",
          tone: "primary",
          textAlign: "center",
          color: "#ffffff",
          fontSize: "38px",
          customCss: `font-family:'Cormorant Garamond',Georgia,serif; font-weight:700; line-height:1.1; margin-bottom:14px;`,
        },
      },
      {
        type: "Text",
        props: {
          id: "pr-sub",
          content: "Enter the exclusive access code from your invitation below. Each code is unique and can only be used once.",
          as: "p",
          size: "md",
          tone: "secondary",
          textAlign: "center",
          fontSize: "15px",
          customCss: `line-height:1.65; font-family:'DM Sans',sans-serif;`,
        },
      },
    ],
  },
};

// ─── Confirmed — You're In ─────────────────────────────────────────────────────

const confirmedComposition = {
  root: { props: { title: "You're In — Velera", backgroundColor: BG } },
  content: [
    nav("Activation Complete"),
    {
      type: "Hero",
      props: {
        id: "cf-hero",
        backgroundImage: "https://picsum.photos/seed/velera-success/1400/400",
        imageFilter: "brightness(0.25) saturate(0.5)",
        overlayGradient: "to-bottom",
        headline: "",
        subheadline: "",
        height: "260px",
        contentPosition: "bottom-left",
      },
    },
    {
      type: "SectionWrap",
      props: {
        id: "cf-wrap",
        maxWidth: "600px",
        paddingTop: "0",
        paddingBottom: "80px",
        paddingX: "24px",
        centered: true,
        customCss: "margin-top:-80px; position:relative;",
      },
    },
  ],
  zones: {
    "cf-wrap:children": [
      {
        type: "SuccessHeader",
        props: {
          id: "cf-success",
          iconBackground: "rgba(74,222,128,0.1)",
          iconBorderColor: "rgba(74,222,128,0.25)",
          iconColor: "#4ade80",
          headline: "You're In.",
          headlineFont: "serif",
          headlineFontSize: "46px",
          subheadline: "Your access has been confirmed. Welcome to Velera — we're thrilled to have you.",
          topLine: true,
          glowColor: "rgba(232,184,75,0.06)",
        },
      },
      {
        type: "StepItem",
        props: {
          id: "cf-step-1",
          icon: "📬",
          title: "Check your inbox",
          description: "A confirmation and next-steps guide has been sent to your registered email.",
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(255,255,255,0.07)",
        },
      },
      {
        type: "StepItem",
        props: {
          id: "cf-step-2",
          icon: "🚀",
          title: "Access goes live in 24h",
          description: "Your Velera dashboard will be ready by the next business day.",
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(255,255,255,0.07)",
        },
      },
      {
        type: "StepItem",
        props: {
          id: "cf-step-3",
          icon: "💬",
          title: "Your team will reach out",
          description: "An account manager will contact you to schedule your onboarding call.",
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(255,255,255,0.07)",
        },
      },
      {
        type: "BrandFooter",
        props: {
          id: "cf-brand",
          brandText: "VELERA",
          tagline: "Member Rewards · December Launch",
          brandFont: "serif",
          brandColor: GOLD,
          background: "transparent",
          paddingY: "24px",
        },
      },
    ],
  },
};

// ─── Upsert all ───────────────────────────────────────────────────────────────

const compositions = {
  [PAGE_IDS.gateway]:   gatewayComposition,
  [PAGE_IDS.offerA]:    offerAComposition,
  [PAGE_IDS.offerB]:    offerBComposition,
  [PAGE_IDS.product]:   productComposition,
  [PAGE_IDS.confirmed]: confirmedComposition,
};

for (const [pageId, tree_json] of Object.entries(compositions)) {
  await sql`
    INSERT INTO campaign_page_compositions (campaign_page_id, tree_json, schema_version, updated_at)
    VALUES (${pageId}, ${JSON.stringify(tree_json)}::jsonb, 2, now())
    ON CONFLICT (campaign_page_id) DO UPDATE
      SET tree_json = EXCLUDED.tree_json, schema_version = 2, updated_at = now()
  `;
  console.log(`✓ ${pageId}`);
}

await sql.end();
console.log("Done.");
