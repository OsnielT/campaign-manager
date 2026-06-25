"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StemflowLogo from "@/components/branding/StemflowLogo";

type Step = "org" | "plan" | "campaign" | "ready";
type PlanId = "free" | "pro" | "enterprise";

const TIERS: {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  popular?: boolean;
}[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    tagline: "Everything you need to launch your first campaigns.",
    features: ["Up to 3 campaigns", "1 team member", "Drag-and-drop builder"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    period: "/mo",
    tagline: "For growing teams running multiple campaigns.",
    features: ["Up to 50 campaigns", "15 team members", "Analytics & integrations"],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    tagline: "Unlimited scale with priority support.",
    features: ["Unlimited campaigns", "Unlimited members", "Priority support & SLA"],
  },
];

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

function getCsrf() {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("primitive_csrf="))
      ?.split("=")[1] ?? ""
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("org");

  // Org step
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgSlugEdited, setOrgSlugEdited] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgId, setOrgId] = useState("");

  // Plan step — Free is the default selection
  const [plan, setPlan] = useState<PlanId>("free");
  const [planError, setPlanError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  // Campaign step
  const [campaignName, setCampaignName] = useState("");
  const [campaignSlug, setCampaignSlug] = useState("");
  const [campaignSlugEdited, setCampaignSlugEdited] = useState(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [createdSlug, setCreatedSlug] = useState("");

  useEffect(() => {
    if (!orgSlugEdited) setOrgSlug(slugify(orgName));
  }, [orgName, orgSlugEdited]);

  useEffect(() => {
    if (!campaignSlugEdited) setCampaignSlug(slugify(campaignName));
  }, [campaignName, campaignSlugEdited]);

  async function handleCreateOrg(e: FormEvent) {
    e.preventDefault();
    setOrgError(null);
    setOrgLoading(true);
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ name: orgName, slug: orgSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrgError(data.error ?? "Failed to create organization");
        return;
      }
      setOrgId(data.org.id);
      setStep("plan");
    } finally {
      setOrgLoading(false);
    }
  }

  async function handleContinueFromPlan() {
    setPlanError(null);
    // Free plan is the default — no payment, continue onboarding.
    if (plan === "free") {
      setStep("campaign");
      return;
    }
    // Paid plans: start Stripe Checkout. The webhook upgrades the org on success.
    setPlanLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setPlanError(data.error ?? "Couldn’t start checkout. You can upgrade later from settings.");
        return;
      }
      window.location.href = data.url as string;
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleCreateCampaign(e: FormEvent) {
    e.preventDefault();
    setCampaignError(null);
    setCampaignLoading(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ name: campaignName, slug: campaignSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          setCampaignError("Plan limit reached");
        } else {
          setCampaignError(data.error ?? "Failed to create campaign");
        }
        return;
      }
      setCreatedSlug(data.campaign.slug);
      setStep("ready");
    } finally {
      setCampaignLoading(false);
    }
  }

  const STEP_LABELS: { id: Step; label: string }[] = [
    { id: "org", label: "Organization" },
    { id: "plan", label: "Plan" },
    { id: "campaign", label: "First campaign" },
    { id: "ready", label: "Ready" },
  ];
  const stepIndex = STEP_LABELS.findIndex((s) => s.id === step);

  return (
    <div style={shell}>
      <div style={card}>
        {/* Logo */}
        <div style={logoRow}>
          <StemflowLogo width={130} />
        </div>

        {/* Step progress */}
        <div style={stepBar}>
          {STEP_LABELS.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700,
                background: i < stepIndex ? "var(--success)" : i === stepIndex ? "var(--accent)" : "var(--bg-raised)",
                color: i <= stepIndex ? "var(--text-inverse)" : "var(--text-muted)",
                border: i > stepIndex ? "1px solid var(--border)" : "none",
                flexShrink: 0,
              }}>
                {i < stepIndex ? "✓" : i + 1}
              </span>
              <span style={{ fontSize: 12, color: i === stepIndex ? "var(--text-primary)" : "var(--text-muted)", fontWeight: i === stepIndex ? 600 : 400 }}>
                {s.label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <span style={{ width: 24, height: 1, background: "var(--border)", margin: "0 4px" }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 1: Create Org ── */}
        {step === "org" && (
          <>
            <h1 style={heading}>Set up your organization</h1>
            <p style={sub}>Your org is your workspace — campaigns, media, and team members all live here.</p>
            <form onSubmit={handleCreateOrg} style={form}>
              {orgError && <p style={errorBox}>{orgError}</p>}
              <label style={label}>
                Organization name
                <input style={input} type="text" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Corp" autoFocus />
              </label>
              <label style={label}>
                Slug
                <div style={slugRow}>
                  <span style={slugPrefix}>primitive.io/</span>
                  <input
                    style={{ ...input, borderRadius: "0 var(--radius) var(--radius) 0", flex: 1 }}
                    type="text" required pattern="[a-z0-9-]+" value={orgSlug}
                    onChange={(e) => { setOrgSlugEdited(true); setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
                  />
                </div>
              </label>
              <button style={btn} type="submit" disabled={orgLoading || !orgName || !orgSlug}>
                {orgLoading ? "Creating…" : "Continue →"}
              </button>
            </form>
          </>
        )}

        {/* ── Step 2: Choose Plan ── */}
        {step === "plan" && (
          <>
            <h1 style={heading}>Choose your plan</h1>
            <p style={sub}>Start free — you can upgrade or downgrade anytime from settings.</p>
            {planError && <p style={errorBox}>{planError}</p>}
            <div role="radiogroup" aria-label="Plan" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {TIERS.map((tier) => {
                const selected = plan === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPlan(tier.id)}
                    style={{ ...tierCard, ...(selected ? tierCardSelected : {}) }}
                  >
                    <span style={{ ...radioOuter, ...(selected ? radioOuterSelected : {}) }}>
                      {selected && <span style={radioInner} />}
                    </span>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={tierName}>{tier.name}</span>
                        {tier.popular && <span style={popularTag}>Popular</span>}
                      </div>
                      <div style={tierTagline}>{tier.tagline}</div>
                      <ul style={tierFeatures}>
                        {tier.features.map((f) => (
                          <li key={f} style={tierFeatureItem}>
                            <span style={{ color: "var(--success)" }}>✓</span> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={tierPrice}>{tier.price}</div>
                      {tier.period && <div style={tierPeriod}>{tier.period}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
            <button style={{ ...btn, marginTop: 16 }} type="button" disabled={planLoading} onClick={handleContinueFromPlan}>
              {planLoading
                ? "Redirecting to checkout…"
                : plan === "free"
                  ? "Continue with Free →"
                  : `Continue to payment →`}
            </button>
          </>
        )}

        {/* ── Step 3: Create Campaign ── */}
        {step === "campaign" && (
          <>
            <h1 style={heading}>Create your first campaign</h1>
            <p style={sub}>Give it a name and a URL slug. You can change both later.</p>
            <form onSubmit={handleCreateCampaign} style={form}>
              {campaignError && <p style={errorBox}>{campaignError}</p>}
              <label style={label}>
                Campaign name
                <input style={input} type="text" required value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Summer Activation 2025" autoFocus />
              </label>
              <label style={label}>
                Slug
                <div style={slugRow}>
                  <span style={slugPrefix}>campaigns/</span>
                  <input
                    style={{ ...input, borderRadius: "0 var(--radius) var(--radius) 0", flex: 1 }}
                    type="text" required pattern="[a-z0-9-]+" value={campaignSlug}
                    onChange={(e) => { setCampaignSlugEdited(true); setCampaignSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
                  />
                </div>
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" style={secondaryBtn} onClick={() => router.push("/dashboard")}>
                  Skip for now
                </button>
                <button style={{ ...btn, flex: 1 }} type="submit" disabled={campaignLoading || !campaignName || !campaignSlug}>
                  {campaignLoading ? "Creating…" : "Create campaign →"}
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Step 3: Ready ── */}
        {step === "ready" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
              <h1 style={{ ...heading, marginBottom: 6 }}>You&apos;re all set!</h1>
              <p style={sub}>Your campaign is ready to build. Here&apos;s what to do next:</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href={`/campaigns/${createdSlug}/compose`} style={nextStepCard}>
                <span style={nextStepIcon}>🎨</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>Compose your pages</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Drag and drop components to build your campaign pages</div>
                </div>
                <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>›</span>
              </Link>
              <Link href={`/campaigns/${createdSlug}/audience`} style={nextStepCard}>
                <span style={nextStepIcon}>👥</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>Import your audience</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Upload a CSV with lookup keys and custom fields</div>
                </div>
                <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>›</span>
              </Link>
              <Link href={`/campaigns/${createdSlug}`} style={nextStepCard}>
                <span style={nextStepIcon}>⚙️</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>Configure & publish</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Set up branching, schedule, and publish when ready</div>
                </div>
                <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>›</span>
              </Link>
            </div>
            <button style={{ ...btn, marginTop: 20 }} onClick={() => router.push("/dashboard")}>
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background: "radial-gradient(ellipse at 50% 0%, #7c5af310 0%, transparent 70%), var(--bg)",
};
const card: React.CSSProperties = {
  width: "100%",
  maxWidth: "460px",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "36px 32px",
  boxShadow: "var(--shadow)",
};
const logoRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" };
const stepBar: React.CSSProperties = { display: "flex", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: 4 };
const heading: React.CSSProperties = { fontSize: "20px", fontWeight: "600", color: "var(--text-primary)", letterSpacing: "-0.3px", marginBottom: "8px" };
const sub: React.CSSProperties = { fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px" };
const form: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "16px" };
const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "500", color: "var(--text-secondary)" };
const input: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", padding: "10px 12px", color: "var(--text-primary)", fontSize: "14px", outline: "none",
};
const slugRow: React.CSSProperties = { display: "flex", alignItems: "stretch" };
const slugPrefix: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border)", borderRight: "none",
  borderRadius: "var(--radius) 0 0 var(--radius)", padding: "10px 10px", fontSize: "13px",
  color: "var(--text-muted)", whiteSpace: "nowrap", display: "flex", alignItems: "center",
};
const btn: React.CSSProperties = {
  marginTop: "4px", background: "var(--accent)", color: "#fff", border: "none",
  borderRadius: "var(--radius)", padding: "11px 16px", fontSize: "14px", fontWeight: "600", cursor: "pointer", width: "100%",
};
const secondaryBtn: React.CSSProperties = {
  marginTop: "4px", background: "transparent", color: "var(--text-secondary)",
  border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "11px 16px",
  fontSize: "14px", fontWeight: "500", cursor: "pointer",
};
const errorBox: React.CSSProperties = {
  background: "#f8717115", border: "1px solid #f87171", borderRadius: "var(--radius-sm)",
  padding: "10px 12px", color: "var(--danger)", fontSize: "13px",
};
const nextStepCard: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px",
  background: "var(--bg-raised)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", textDecoration: "none", transition: "border-color 0.1s",
};
const nextStepIcon: React.CSSProperties = { fontSize: 20, flexShrink: 0, marginTop: 1 };

// ── Plan tiers ──
const tierCard: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "14px 16px",
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  transition: "border-color 0.1s, box-shadow 0.1s",
};
const tierCardSelected: React.CSSProperties = {
  borderColor: "var(--accent)",
  boxShadow: "0 0 0 1px var(--accent)",
};
const radioOuter: React.CSSProperties = {
  width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2,
  border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
};
const radioOuterSelected: React.CSSProperties = { borderColor: "var(--accent)" };
const radioInner: React.CSSProperties = {
  width: 8, height: 8, borderRadius: "50%", background: "var(--accent)",
};
const tierName: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: "var(--text-primary)" };
const popularTag: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
  color: "var(--text-inverse)", background: "var(--accent)", borderRadius: 999, padding: "2px 8px",
};
const tierTagline: React.CSSProperties = { fontSize: 12, color: "var(--text-secondary)", marginTop: 2 };
const tierFeatures: React.CSSProperties = { listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 3 };
const tierFeatureItem: React.CSSProperties = { fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 6, alignItems: "center" };
const tierPrice: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: "var(--text-primary)" };
const tierPeriod: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)" };
