// Per-template starter email. When a campaign is created from a built-in
// template, it arrives with a matching broadcast — same brand voice and story
// as the campaign flow — that nudges the consumer to take the next action.
// The email inherits the campaign theme automatically via the renderer.

import { newBlockId, type EmailBlock, type EmailBlockType, type EmailDesign } from "@/lib/email/design";

function block(type: EmailBlockType, props: Record<string, unknown>): EmailBlock {
  return { id: newBlockId(type), type, props };
}

interface BuildArgs { brand: string; heading: string; body: string; cta: string; href: string; footer?: string }

function buildDesign({ brand, heading, body, cta, href, footer }: BuildArgs): EmailDesign {
  return {
    blocks: [
      block("logo", { text: brand, imageUrl: "", height: "36px", align: "center", color: "" }),
      block("spacer", { height: "6px" }),
      block("heading", { text: heading, level: "h1", align: "left", color: "", fontSize: "26px" }),
      block("text", { html: body, align: "left", color: "", fontSize: "15px" }),
      block("button", { label: cta, href, bg: "", color: "#ffffff", radius: "8px", align: "left" }),
      block("divider", { color: "", paddingY: "20px" }),
      block("footer", { text: footer ?? `${brand} — you're receiving this because you signed up.`, color: "", showUnsubscribe: true }),
    ],
  };
}

export interface EmailSeed { name: string; subject: string; preheader: string; design: EmailDesign }

/** Returns a template-aligned starter email, or null for templates without one. */
export function emailSeedFor(templateId: string, campaignUrl: string): EmailSeed | null {
  const url = campaignUrl;
  const seeds: Record<string, EmailSeed> = {
    blank: {
      name: "Welcome email",
      subject: "Welcome — let's get started",
      preheader: "Glad you're here. Take the next step.",
      design: buildDesign({
        brand: "BRAND",
        heading: "Thanks for stopping by",
        body: "<p>Hi {{name}}, we're glad you're here.</p><p>Take the next step and see what we built for you.</p>",
        cta: "Get started", href: url,
      }),
    },
    activation: {
      name: "Member welcome",
      subject: "Your AURUM access is ready",
      preheader: "Unlock members-only pricing, early access, and perks.",
      design: buildDesign({
        brand: "AURUM",
        heading: "Welcome to the club",
        body: "<p>Hi {{name}},</p><p>Your members-only pricing, early access, and exclusive perks are ready. Enter your code to activate everything waiting for you.</p>",
        cta: "Unlock my access", href: url,
        footer: "AURUM Members Club — members-only access.",
      }),
    },
    "lead-capture": {
      name: "Subscriber welcome",
      subject: "You're on the list 🎉",
      preheader: "Your first issue is on the way.",
      design: buildDesign({
        brand: "NORTH",
        heading: "Welcome to the insider newsletter",
        body: "<p>Hi {{name}}, thanks for subscribing!</p><p>Actionable tips, trends, and tools are headed to your inbox every week. Here's your first read to get going.</p>",
        cta: "Read the latest", href: url,
        footer: "The NORTH newsletter — unsubscribe anytime.",
      }),
    },
    "multi-offer": {
      name: "Pick your plan",
      subject: "Pick the plan that fits",
      preheader: "Starter or Pro — start building today.",
      design: buildDesign({
        brand: "FORGE",
        heading: "Two ways to get started",
        body: "<p>Hi {{name}},</p><p>Choose the plan that's right for you — <strong>Starter</strong> to get going or <strong>Pro</strong> for unlimited projects and priority support. You can change it anytime.</p>",
        cta: "Choose your plan", href: url,
      }),
    },
    webinar: {
      name: "Registration confirmation",
      subject: "You're registered for the Growth Summit",
      preheader: "Save the date and bring your questions.",
      design: buildDesign({
        brand: "SUMMIT",
        heading: "See you at the Summit",
        body: "<p>Hi {{name}}, your seat is saved!</p><p>This is a live, no-fluff workshop you can act on the same day. Add it to your calendar and come ready with your questions — and you'll get the full recording afterward.</p>",
        cta: "View event details", href: url,
        footer: "The 2026 Growth Summit — see you live.",
      }),
    },
    "fitness-quiz": {
      name: "Your plan is ready",
      subject: "Your personalized plan is ready",
      preheader: "Built from your answers — let's hit your goal.",
      design: buildDesign({
        brand: "PEAK",
        heading: "Let's hit your goal",
        body: "<p>Hi {{name}},</p><p>Based on your answers, we built a plan just for you. Jump back in to see your routine and start today — small steps, real results.</p>",
        cta: "See my plan", href: url,
        footer: "PEAK — your plan, your pace.",
      }),
    },
    "vip-access": {
      name: "VIP early access",
      subject: "Your VIP early access is unlocked",
      preheader: "You're in before everyone else.",
      design: buildDesign({
        brand: "AURUM",
        heading: "You're in early",
        body: "<p>Hi {{name}},</p><p>As a VIP, you get the first look before anyone else. Reveal what's waiting for you and claim your early-access perks.</p>",
        cta: "Reveal my access", href: url,
        footer: "AURUM — invitation only.",
      }),
    },
    "b2b-demo": {
      name: "Book your demo",
      subject: "Ready to see it in action?",
      preheader: "A quick walkthrough for your team.",
      design: buildDesign({
        brand: "NORTH",
        heading: "Book your demo",
        body: "<p>Hi {{name}},</p><p>See how it works for your team in a quick, tailored walkthrough — or grab the resources to explore at your own pace.</p>",
        cta: "Book a demo", href: url,
        footer: "NORTH for Enterprise.",
      }),
    },
  };
  return seeds[templateId] ?? null;
}
