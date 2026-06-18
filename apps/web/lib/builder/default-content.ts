/**
 * Branded starter content for built-in campaign templates.
 *
 * Server-safe (no React) — used when creating a campaign so each template page
 * arrives with a designed, on-brand Puck composition (hero imagery, feature
 * lists, pricing cards, steps and placeholder copy) instead of a blank canvas.
 * The public renderer fills component defaults for any prop we omit, so we only
 * set an `id` plus the props worth pre-filling.
 *
 * Placeholder photos use picsum.photos (stable per seed); the CSP allows any
 * https image, and users swap them in the editor.
 */
import { randomUUID } from "crypto";

export interface PuckItem {
  type: string;
  props: Record<string, unknown>;
}
export interface PuckTree {
  content: PuckItem[];
  root: { props: Record<string, unknown> };
  zones: Record<string, PuckItem[]>;
}

// ─── Low-level builders ────────────────────────────────────────────────────────

function node(type: string, props: Record<string, unknown> = {}): PuckItem {
  return { type, props: { id: `${type}-${randomUUID().slice(0, 8)}`, ...props } };
}

type Block = PuckItem | Container;
interface Container {
  kind: "container";
  item: PuckItem;
  children: Block[];
}
function isContainer(b: Block): b is Container {
  return (b as Container).kind === "container";
}

/** Centered content section — width/padding inherit the brand density. */
function section(...children: Block[]): Container {
  return {
    kind: "container",
    item: node("SectionWrap", { paddingX: "24px", centered: true }),
    children,
  };
}
/** Wider section, for pricing grids and galleries (padding still inherits density). */
function wide(...children: Block[]): Container {
  return {
    kind: "container",
    item: node("SectionWrap", { maxWidth: "980px", paddingX: "24px", centered: true }),
    children,
  };
}
/** Responsive card grid — gap inherits the brand density. */
function grid(columns: 1 | 2 | 3, ...cards: Block[]): Container {
  return { kind: "container", item: node("TierGrid", { columns: String(columns) }), children: cards };
}

/** Build a page tree, flattening nested containers into the zones map. */
function tree(...blocks: Block[]): PuckTree {
  const content: PuckItem[] = [];
  const zones: Record<string, PuckItem[]> = {};
  const walk = (nodes: Block[], into: PuckItem[]) => {
    for (const b of nodes) {
      if (isContainer(b)) {
        into.push(b.item);
        const childList: PuckItem[] = [];
        walk(b.children, childList);
        zones[`${b.item.props.id}:children`] = childList;
      } else {
        into.push(b);
      }
    }
  };
  walk(blocks, content);
  return { content, root: { props: {} }, zones };
}

// ─── Content helpers ───────────────────────────────────────────────────────────

const pic = (seed: string, w = 1600, h = 900) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

/** A Text child node for a compositional block's slot. */
const txt = (content: string, props: Record<string, unknown> = {}): PuckItem =>
  node("Text", { content, ...props });

const nav = (brand: string, badge: string) =>
  node("CampaignNav", { logoText: brand, badgeText: badge });

const footer = (brand: string, tagline = "") =>
  node("BrandFooter", { brandText: brand, tagline });

function hero(opts: {
  bg?: string;
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  center?: boolean;
  height?: string;
}): PuckItem {
  return node("Hero", {
    backgroundImage: opts.bg ?? "",
    overlayGradient: "diagonal",
    height: opts.height ?? "460px",
    contentPosition: opts.center ? "center" : "bottom-left",
    textAlign: opts.center ? "center" : "left",
    eyebrow: opts.eyebrow
      ? [txt(opts.eyebrow, { as: "p", size: "sm", weight: "semibold", color: "var(--campaign-accent, #e8b84b)" })]
      : [],
    headline: [txt(opts.headline, { as: "h1", size: "lg", weight: "semibold", fontSize: "clamp(36px,5vw,60px)" })],
    subheadline: opts.subheadline ? [txt(opts.subheadline, { as: "p", size: "md" })] : [],
  });
}

const richText = (html: string) => node("RichText", { content: html });

const featureList = (...texts: string[]) =>
  node("FeatureList", { items: texts.map((text) => ({ text })), iconStyle: "circle", size: "md", gap: "normal" });

const image = (seed: string, alt = "") =>
  node("Image", { src: pic(seed, 1200, 720), alt, height: "auto", objectFit: "cover", borderRadius: "16px" });

const stepItem = (icon: string, title: string, description: string) =>
  node("StepItem", {
    icon,
    title: [txt(title, { as: "p", size: "md", weight: "semibold" })],
    description: [txt(description, { as: "p", size: "sm" })],
  });

const divider = (label = "") => node("Divider", { label });

function tierCard(opts: {
  tierLabel: string;
  title: string;
  price: string;
  priceSubtext?: string;
  features: string[];
  ctaLabel?: string;
  featured?: boolean;
  featuredLabel?: string;
}): PuckItem {
  return node("TierCard", {
    tierLabel: opts.tierLabel,
    tierIcon: opts.featured ? "star" : "circle",
    isFeatured: Boolean(opts.featured),
    featuredLabel: opts.featuredLabel ?? "",
    topLine: "left",
    heading: [
      txt(opts.title, { as: "h3", size: "lg", weight: "semibold" }),
      txt(opts.price, { as: "p", size: "lg", weight: "semibold" }),
      ...(opts.priceSubtext ? [txt(opts.priceSubtext, { as: "p", size: "sm" })] : []),
    ],
    features: opts.features.map((text) => txt(text, { as: "p", size: "sm" })),
    footer: opts.ctaLabel
      ? [node("campaign-conversion-button", { label: opts.ctaLabel, navigateTo: "next" })]
      : [],
  });
}

const cbutton = (label: string, navigateTo: "next" | "url" = "next", targetUrl?: string) =>
  node("campaign-conversion-button", { label, navigateTo, ...(targetUrl ? { targetUrl } : {}) });

const successHeader = (headline: string, subheadline: string) =>
  node("SuccessHeader", {
    headline: [txt(headline, { as: "h1", size: "lg", weight: "semibold", fontSize: "46px" })],
    subheadline: [txt(subheadline, { as: "p", size: "md" })],
  });

// ─── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATE_CONTENT: Record<string, PuckTree[]> = {
  // ─── Blank ────────────────────────────────────────────────────────────────
  blank: [
    tree(
      nav("BRAND", "Campaign"),
      hero({
        bg: pic("brand-hero", 1600, 900),
        eyebrow: "Welcome",
        headline: "Build something people love",
        subheadline: "A clean, conversion-ready starting point — make it yours in minutes.",
      }),
      section(
        richText("<p>This is your campaign canvas. Replace this copy, drop in components from the left, and wire your flow on the canvas. Everything below is just a starting point.</p>"),
        featureList("Fast to set up", "Fully customizable", "Built to convert"),
        cbutton("Get started"),
      ),
    ),
    tree(
      successHeader("You're all set", "Thanks for stopping by."),
      footer("BRAND", "© 2026 Your Company"),
    ),
  ],

  // ─── Activation code ─────────────────────────────────────────────────────────
  activation: [
    tree(
      nav("AURUM", "Members"),
      hero({
        bg: pic("members-vault", 1600, 900),
        eyebrow: "Members only",
        headline: "Enter your access code",
        subheadline: "Use the code from your invitation to unlock your benefits.",
      }),
      section(
        richText("<p>Your code unlocks members-only pricing, early access, and exclusive perks.</p>"),
        featureList("Members-only pricing", "Early access to drops", "Priority support"),
      ),
      node("audience-lookup", { label: "Your access code", placeholder: "e.g. AURUM-2026", buttonLabel: "Unlock" }),
    ),
    tree(
      successHeader("You're in.", "Your access is now active."),
      section(
        divider("What's next"),
        grid(3,
          stepItem("📩", "Check your inbox", "We've emailed your confirmation and next steps."),
          stepItem("🎁", "Claim your perks", "Your member benefits are unlocked and ready."),
          stepItem("⭐", "Stay tuned", "We'll let you know the moment new drops go live."),
        ),
      ),
      footer("AURUM", "Members club"),
    ),
  ],

  // ─── Lead capture ─────────────────────────────────────────────────────────────
  "lead-capture": [
    tree(
      nav("NORTH", "Newsletter"),
      hero({
        bg: pic("newsletter-desk", 1600, 900),
        eyebrow: "Join 12,000+ readers",
        headline: "Get the insider newsletter",
        subheadline: "Tips, trends, and tools — straight to your inbox, every week.",
      }),
      section(
        featureList("Actionable insights every week", "No spam, ever", "Unsubscribe in one click"),
        node("campaign-form", {
          buttonLabel: "Subscribe",
          conversionTrigger: true,
          fields: [
            { key: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
            { key: "email", label: "Email", type: "email", required: true, placeholder: "you@example.com" },
          ],
        }),
      ),
    ),
    tree(
      successHeader("You're subscribed!", "Check your inbox to confirm — your first issue is on the way."),
      footer("NORTH", "The North newsletter"),
    ),
  ],

  // ─── Multi-offer ──────────────────────────────────────────────────────────────
  "multi-offer": [
    tree(
      nav("FORGE", "Pricing"),
      hero({
        bg: pic("pricing-tools", 1600, 900),
        eyebrow: "Simple pricing",
        headline: "Choose the plan that fits",
        subheadline: "Two ways to get started — pick the one that's right for you.",
      }),
      wide(
        grid(2,
          tierCard({ tierLabel: "Starter", title: "Starter", price: "$19", priceSubtext: "/mo", features: ["Everything to get going", "Up to 3 projects", "Email support"] }),
          tierCard({ tierLabel: "Pro", title: "Pro", price: "$49", priceSubtext: "/mo", features: ["Everything in Starter", "Unlimited projects", "Priority support"], featured: true, featuredLabel: "Most popular" }),
        ),
      ),
      section(
        node("campaign-form", {
          buttonLabel: "Continue",
          conversionTrigger: true,
          fields: [
            { key: "offer", label: "Which plan?", type: "select", required: true, placeholder: "Select a plan…", options: [{ label: "Starter — $19/mo", value: "a" }, { label: "Pro — $49/mo", value: "b" }] },
          ],
        }),
      ),
    ),
    tree(
      nav("FORGE", "Starter"),
      hero({ bg: pic("starter-plan", 1600, 800), eyebrow: "Starter", headline: "Starter plan", subheadline: "Everything you need to launch." }),
      section(
        featureList("Up to 3 projects", "Core analytics", "Email support", "Cancel anytime"),
        cbutton("Choose Starter"),
      ),
    ),
    tree(
      nav("FORGE", "Pro"),
      hero({ bg: pic("pro-plan", 1600, 800), eyebrow: "Pro", headline: "Pro plan", subheadline: "For teams ready to scale." }),
      section(
        featureList("Unlimited projects", "Advanced analytics", "Priority support", "Team collaboration"),
        cbutton("Choose Pro"),
      ),
    ),
    tree(
      successHeader("All set!", "Your plan is confirmed — welcome aboard."),
      footer("FORGE", "Build faster"),
    ),
  ],

  // ─── Webinar / Event ──────────────────────────────────────────────────────────
  webinar: [
    tree(
      nav("SUMMIT", "Live event"),
      hero({
        bg: pic("conference-stage", 1600, 900),
        eyebrow: "Free live session · May 14",
        headline: "The 2026 Growth Summit",
        subheadline: "Join 2,000+ operators for a live, no-fluff workshop you can act on the same day.",
      }),
      section(
        richText("<p>One hour. Real tactics. Live Q&amp;A. Walk away with a playbook you can put to work immediately — plus the full recording.</p>"),
        featureList("Live demos you can copy", "Real Q&A with the experts", "Free recording for every attendee"),
      ),
      wide(
        grid(3,
          stepItem("🗓️", "Register free", "Save your seat in 30 seconds."),
          stepItem("🎥", "Join us live", "Tune in from anywhere — desktop or mobile."),
          stepItem("🚀", "Put it to work", "Leave with a step-by-step playbook."),
        ),
      ),
      section(cbutton("Register now")),
    ),
    tree(
      nav("SUMMIT", "Registration"),
      hero({ bg: pic("register-seats", 1600, 800), eyebrow: "Almost there", headline: "Save your spot", subheadline: "Tell us where to send the details." }),
      section(
        node("campaign-form", {
          buttonLabel: "Register",
          conversionTrigger: true,
          fields: [
            { key: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
            { key: "email", label: "Email", type: "email", required: true, placeholder: "you@example.com" },
            { key: "ticket", label: "Ticket type", type: "select", required: true, placeholder: "Choose…", options: [{ label: "Free — live access", value: "free" }, { label: "VIP — front row + recording + workbook", value: "vip" }] },
          ],
        }),
      ),
    ),
    tree(
      nav("SUMMIT", "VIP"),
      hero({ bg: pic("vip-event", 1600, 800), eyebrow: "Limited VIP seats", headline: "Go VIP", subheadline: "Get the most out of the session." }),
      wide(
        grid(1,
          tierCard({ tierLabel: "VIP Pass", title: "VIP Experience", price: "$49", priceSubtext: "one-time", features: ["Priority front-row seating", "Lifetime access to the recording", "Exclusive after-session Q&A", "Downloadable workbook"], ctaLabel: "", featured: true, featuredLabel: "Best value" }),
        ),
      ),
      section(cbutton("Confirm VIP seat")),
    ),
    tree(
      successHeader("You're registered!", "Check your inbox — we've sent your calendar invite and join link."),
      section(
        divider("Before the session"),
        grid(2,
          stepItem("📅", "Add it to your calendar", "Your invite is in your inbox — one click to save the date."),
          stepItem("👋", "Bring a question", "We'll answer as many as we can, live."),
        ),
      ),
      footer("SUMMIT", "The Growth Summit"),
    ),
  ],

  // ─── Fitness quiz ─────────────────────────────────────────────────────────────
  "fitness-quiz": [
    tree(
      nav("PEAK", "Free trial"),
      hero({
        bg: pic("gym-training", 1600, 900),
        eyebrow: "Personalized in 10 seconds",
        headline: "Find your perfect plan",
        subheadline: "Answer one question and get a training plan built around your goal.",
      }),
      section(
        featureList("Tailored to your goal", "Workouts that fit your schedule", "Cancel anytime — no commitment"),
      ),
      wide(
        grid(3,
          stepItem("🎯", "Pick your goal", "Tell us what you're training for."),
          stepItem("📋", "Get your plan", "We'll match you to the right program."),
          stepItem("💪", "Start free", "Begin your trial today."),
        ),
      ),
      section(cbutton("Take the quiz")),
    ),
    tree(
      nav("PEAK", "Quiz"),
      hero({ bg: pic("quiz-fitness", 1600, 800), eyebrow: "One quick question", headline: "What's your main goal?", subheadline: "Pick the one that fits you best — we'll handle the rest." }),
      section(
        node("campaign-form", {
          buttonLabel: "See my plan",
          conversionTrigger: false,
          fields: [
            { key: "goal", label: "Your main goal", type: "select", required: true, placeholder: "Choose…", options: [{ label: "Lose weight", value: "lose" }, { label: "Build muscle", value: "muscle" }, { label: "Stay active", value: "active" }] },
          ],
        }),
      ),
    ),
    planPage("weight-loss", "Weight Loss Program", "Lean out for good", "A fat-burning mix of cardio and strength, built to keep the weight off.",
      ["3–4 guided sessions a week", "Simple nutrition guidance", "Progress tracking that keeps you honest"]),
    planPage("muscle", "Muscle Building Program", "Build real strength", "Progressive strength training designed to add size and power.",
      ["Structured progressive overload", "Compound-lift focus", "Recovery and mobility built in"]),
    planPage("active", "Active Lifestyle Program", "Feel your best", "Balanced workouts to keep you energized, mobile, and moving.",
      ["Mix of strength and cardio", "Low-impact options", "Flexible scheduling"]),
    tree(
      successHeader("Trial activated!", "Your first workout is waiting in your inbox — let's go."),
      footer("PEAK", "Train with purpose"),
    ),
  ],

  // ─── VIP early access ─────────────────────────────────────────────────────────
  "vip-access": [
    tree(
      nav("AURUM", "Invitation only"),
      hero({
        bg: pic("luxury-drop", 1600, 900),
        eyebrow: "Early access",
        headline: "Enter your access code",
        subheadline: "Unlock the drop before it opens to the public.",
      }),
      section(
        featureList("First access before public launch", "Members-only pricing", "Free express shipping"),
      ),
      node("audience-lookup", { label: "Your access code", placeholder: "e.g. AURUM-2026", buttonLabel: "Unlock" }),
    ),
    tree(
      nav("AURUM", "Welcome"),
      hero({ bg: pic("vip-welcome", 1600, 800), eyebrow: "You're on the list", headline: "Your early access is ready", subheadline: "Here's your exclusive offer." }),
      section(
        richText("<p style=\"font-size:20px\">Welcome back,</p>"),
        node("campaign-data-field", { fieldKey: "name", fallback: "VIP member", size: "lg" }),
        image("vip-product", "Featured product"),
        richText("<p>As a VIP, you get first access at members-only pricing — before anyone else.</p>"),
        cbutton("Claim my early access"),
      ),
    ),
    tree(
      successHeader("Your spot is reserved", "We'll email you the moment it goes live."),
      footer("AURUM", "Members club"),
    ),
  ],

  // ─── B2B demo router ──────────────────────────────────────────────────────────
  "b2b-demo": [
    // Entry router: silently advances to an A/B-split landing on first load.
    tree(
      node("campaign-auto-advance", {}),
      section(richText("<p style=\"text-align:center;opacity:0.6\">Loading…</p>")),
    ),
    tree(
      nav("NORTH", "Free guide"),
      hero({
        bg: pic("office-velocity", 1600, 900),
        eyebrow: "Free playbook",
        headline: "Ship faster with North",
        subheadline: "The operating system high-velocity teams use to move quicker — without the chaos.",
      }),
      section(
        featureList("The exact workflow used by top teams", "Templates you can copy today", "Backed by real benchmarks"),
        image("guide-cover-a", "Guide preview"),
        cbutton("Get the guide"),
      ),
    ),
    tree(
      nav("NORTH", "Free guide"),
      hero({
        bg: pic("office-savings", 1600, 900),
        eyebrow: "Free playbook",
        headline: "Cut costs with North",
        subheadline: "Do more with less — trim spend while you scale output.",
      }),
      section(
        featureList("Where teams overspend (and how to fix it)", "A cost-cutting checklist", "Real before/after numbers"),
        image("guide-cover-b", "Guide preview"),
        cbutton("Get the guide"),
      ),
    ),
    tree(
      nav("NORTH", "Almost there"),
      hero({ bg: pic("details-b2b", 1600, 800), eyebrow: "Almost there", headline: "Where should we send it?", subheadline: "Tell us a bit about your team." }),
      section(
        node("campaign-form", {
          buttonLabel: "Continue",
          conversionTrigger: false,
          fields: [
            { key: "work_email", label: "Work email", type: "email", required: true, placeholder: "you@company.com" },
            { key: "company_size", label: "Company size", type: "select", required: true, placeholder: "Choose…", options: [{ label: "1–50", value: "small" }, { label: "51–500", value: "mid" }, { label: "500+", value: "enterprise" }] },
          ],
        }),
      ),
    ),
    tree(
      nav("NORTH", "Enterprise"),
      hero({ bg: pic("enterprise-call", 1600, 800), eyebrow: "For enterprise teams", headline: "Let's tailor it to your team", subheadline: "Your guide is on the way — and we'd love to help you roll it out." }),
      section(
        richText("<p>Book a 20-minute call and we'll walk through how teams your size put this into practice.</p>"),
        grid(3,
          stepItem("📨", "Get the guide", "It's already in your inbox."),
          stepItem("📞", "Book a call", "Pick a time that works for you."),
          stepItem("🚀", "Roll it out", "We'll help you tailor it to your team."),
        ),
        cbutton("Book a call", "url", "https://cal.com/"),
      ),
    ),
    tree(
      nav("NORTH", "All set"),
      hero({ bg: pic("download-ready", 1600, 800), eyebrow: "All set", headline: "Your guide is ready", subheadline: "Thanks — grab your copy below." }),
      section(
        richText("<p>We've also emailed you a copy so it's easy to find later.</p>"),
        cbutton("Download the guide", "url", "#"),
      ),
    ),
  ],
};

/** A fitness plan page: branded hero + benefits + a trial-signup form. */
function planPage(seed: string, name: string, eyebrow: string, desc: string, features: string[]): PuckTree {
  return tree(
    nav("PEAK", "Your plan"),
    hero({ bg: pic(`plan-${seed}`, 1600, 800), eyebrow, headline: name, subheadline: desc }),
    section(
      featureList(...features),
      node("campaign-form", {
        buttonLabel: "Start free trial",
        conversionTrigger: true,
        fields: [
          { key: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
          { key: "email", label: "Email", type: "email", required: true, placeholder: "you@example.com" },
        ],
      }),
    ),
  );
}

/** Starter tree for a given built-in template page (by position). */
export function defaultTreeFor(templateId: string, position: number): PuckTree {
  const list = TEMPLATE_CONTENT[templateId] ?? TEMPLATE_CONTENT.blank;
  return list[position] ?? tree(hero({ headline: "New page", subheadline: "Add your content here." }));
}
