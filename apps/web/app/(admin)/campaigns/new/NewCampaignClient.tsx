"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function getCsrf() {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("primitive_csrf="))
      ?.split("=")[1] ?? ""
  );
}

interface BuiltInTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;
  hint: string;
}

const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    id: "blank",
    label: "Blank",
    description: "Start from scratch",
    icon: "📄",
    hint: "Create an empty campaign with one landing page. You build everything.",
  },
  {
    id: "activation",
    label: "Activation code",
    description: "Audience lookup + confirmation",
    icon: "🔑",
    hint: "A landing page with an audience lookup form + a confirmation page. Great for code activations.",
  },
  {
    id: "lead-capture",
    label: "Lead capture",
    description: "Form → thank you",
    icon: "📋",
    hint: "A landing page with a form + a thank-you confirmation page. Great for lead gen.",
  },
  {
    id: "multi-offer",
    label: "Multi-offer",
    description: "Product selection → branching → offer",
    icon: "🎯",
    hint: "Landing → product selection → branching → offer pages. Great for targeted promotions.",
  },
  {
    id: "webinar",
    label: "Webinar / Event",
    description: "Register → Free vs VIP → confirm",
    icon: "🎟️",
    hint: "Landing → registration form → branch on Free vs VIP ticket → confirmation. Tracks registered and VIP goals separately.",
  },
  {
    id: "fitness-quiz",
    label: "Fitness quiz",
    description: "Goal quiz → personalized plan",
    icon: "💪",
    hint: "A 'find your plan' quiz that routes visitors to a personalized plan based on their goal, then a free-trial signup.",
  },
  {
    id: "vip-access",
    label: "VIP early access",
    description: "Code → personalized reveal",
    icon: "⭐",
    hint: "Enter-a-code gate → a reveal page personalized with the visitor's name → single-use redemption. Import a CSV of codes first.",
  },
  {
    id: "b2b-demo",
    label: "B2B demo router",
    description: "A/B landing → demo vs download",
    icon: "🏢",
    hint: "A/B-tests two landing headlines, then routes enterprise leads to a demo and smaller ones to an instant download.",
  },
];

interface OrgTemplate {
  id: string;
  name: string;
  slug: string;
  pages: { id: string }[];
  flowNodes: { id: string; type: string }[];
}

type SelectionKind =
  | { kind: "builtin"; templateId: string }
  | { kind: "org"; templateId: string };

type Step = "template" | "details";

export function NewCampaignClient({ orgTemplates }: { orgTemplates: OrgTemplate[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("template");
  const [selection, setSelection] = useState<SelectionKind>({ kind: "builtin", templateId: "blank" });
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name));
  }, [name, slugEdited]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body =
        selection.kind === "org"
          ? { name, slug, fromTemplateId: selection.templateId }
          : { name, slug, templateId: selection.templateId };

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          setError("PLAN_LIMIT");
        } else {
          setError(data.error ?? "Failed to create campaign");
        }
        return;
      }
      router.push(`/campaigns/${data.campaign.slug}`);
    } finally {
      setLoading(false);
    }
  }

  // Summary hint for the selected template
  function getHint(): string {
    if (selection.kind === "builtin") {
      return BUILT_IN_TEMPLATES.find((t) => t.id === selection.templateId)?.hint ?? "";
    }
    const tpl = orgTemplates.find((t) => t.id === selection.templateId);
    if (!tpl) return "";
    const pages = tpl.pages.length;
    const branches = tpl.flowNodes.filter((n) => n.type === "branch").length;
    return `Your template "${tpl.name}" — ${pages} ${pages === 1 ? "page" : "pages"}${branches > 0 ? `, ${branches} ${branches === 1 ? "branch" : "branches"}` : ""}`;
  }

  const hint = getHint();

  return (
    <div style={page}>
      <div style={breadcrumb}>
        <Link href="/campaigns" style={breadcrumbLink}>Campaigns</Link>
        <span style={breadcrumbSep}>/</span>
        <span style={breadcrumbCurrent}>New</span>
      </div>

      <h1 style={heading}>New campaign</h1>

      {/* ── Step 1: Template picker ── */}
      {step === "template" && (
        <div>
          <p style={stepSub}>Choose a starting point for your campaign.</p>

          {/* Org templates section */}
          {orgTemplates.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={sectionLabel}>Your templates</div>
              <div style={templateGrid}>
                {orgTemplates.map((t) => {
                  const active = selection.kind === "org" && selection.templateId === t.id;
                  const pages = t.pages.length;
                  const branches = t.flowNodes.filter((n) => n.type === "branch").length;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelection({ kind: "org", templateId: t.id })}
                      style={{
                        ...templateCard,
                        border: active ? "2px solid var(--accent)" : "1px solid var(--border)",
                        background: active ? "var(--accent-muted)" : "var(--bg-surface)",
                      }}
                    >
                      <span style={{ fontSize: 24, display: "block", marginBottom: 8 }}>⬡</span>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {pages} {pages === 1 ? "page" : "pages"}
                        {branches > 0 ? ` · ${branches} ${branches === 1 ? "branch" : "branches"}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Built-in templates section */}
          <div>
            {orgTemplates.length > 0 && <div style={sectionLabel}>Built-in templates</div>}
            <div style={templateGrid}>
              {BUILT_IN_TEMPLATES.map((t) => {
                const active = selection.kind === "builtin" && selection.templateId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelection({ kind: "builtin", templateId: t.id })}
                    style={{
                      ...templateCard,
                      border: active ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: active ? "var(--accent-muted)" : "var(--bg-surface)",
                    }}
                  >
                    <span style={{ fontSize: 28, display: "block", marginBottom: 10 }}>{t.icon}</span>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 4 }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {hint && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12, marginBottom: 20, padding: "10px 14px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
              💡 {hint}
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: hint ? 0 : 20 }}>
            <Link href="/campaigns" style={cancelBtn}>Cancel</Link>
            <button style={submitBtn} onClick={() => setStep("details")}>Continue →</button>
          </div>
        </div>
      )}

      {/* ── Step 2: Details ── */}
      {step === "details" && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => setStep("template")}
              style={{ background: "none", border: "none", color: "var(--accent-hover)", cursor: "pointer", fontSize: 13, padding: 0 }}
            >
              ← Back
            </button>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Template:{" "}
              <strong>
                {selection.kind === "builtin"
                  ? `${BUILT_IN_TEMPLATES.find((t) => t.id === selection.templateId)?.icon} ${BUILT_IN_TEMPLATES.find((t) => t.id === selection.templateId)?.label}`
                  : `⬡ ${orgTemplates.find((t) => t.id === selection.templateId)?.name}`}
              </strong>
            </span>
          </div>

          <form onSubmit={handleSubmit} style={form}>
            {error === "PLAN_LIMIT" ? (
              <div style={upgradeBox}>
                <p style={{ fontWeight: 600, margin: "0 0 6px", color: "var(--text-primary)" }}>Campaign limit reached</p>
                <p style={{ fontSize: 13, margin: "0 0 14px", color: "var(--text-secondary)" }}>Your plan allows a limited number of campaigns. Upgrade to create more.</p>
                <Link href="/org/settings" style={upgradeLink}>Upgrade plan →</Link>
              </div>
            ) : error ? (
              <p style={errorBox}>{error}</p>
            ) : null}

            <label style={labelStyle}>
              Campaign name
              <input
                style={input}
                type="text"
                required
                autoFocus
                placeholder="Spring Launch 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label style={labelStyle}>
              Slug
              <div style={slugRow}>
                <span style={slugPrefix}>campaigns/</span>
                <input
                  style={{ ...input, borderRadius: "0 var(--radius) var(--radius) 0", flex: 1 }}
                  type="text"
                  required
                  pattern="[a-z0-9-]+"
                  placeholder="spring-launch-2025"
                  value={slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  }}
                />
              </div>
              <span style={hintStyle}>Used in the public URL. Lowercase letters, numbers, hyphens.</span>
            </label>

            <div style={actions}>
              <Link href="/campaigns" style={cancelBtn}>Cancel</Link>
              <button style={submitBtn} type="submit" disabled={loading || !name || !slug}>
                {loading ? "Creating…" : "Create campaign"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const page: React.CSSProperties = { padding: "32px 36px" };
const breadcrumb: React.CSSProperties = { display: "flex", alignItems: "center", gap: "6px", marginBottom: "20px", fontSize: "13px" };
const breadcrumbLink: React.CSSProperties = { color: "var(--text-secondary)" };
const breadcrumbSep: React.CSSProperties = { color: "var(--text-muted)" };
const breadcrumbCurrent: React.CSSProperties = { color: "var(--text-primary)" };
const heading: React.CSSProperties = { fontSize: "22px", fontWeight: "600", color: "var(--text-primary)", letterSpacing: "-0.4px", marginBottom: "24px" };
const stepSub: React.CSSProperties = { fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px" };
const sectionLabel: React.CSSProperties = { fontSize: "11px", fontWeight: "600", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "10px" };
const templateGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 };
const templateCard: React.CSSProperties = { padding: "18px 16px", borderRadius: "var(--radius-lg)", cursor: "pointer", textAlign: "left", transition: "border-color 0.1s, background 0.1s" };
const card: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "28px 28px" };
const form: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "20px" };
const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "500", color: "var(--text-secondary)" };
const input: React.CSSProperties = { background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px", color: "var(--text-primary)", fontSize: "14px", outline: "none" };
const slugRow: React.CSSProperties = { display: "flex", alignItems: "stretch" };
const slugPrefix: React.CSSProperties = { background: "var(--bg-raised)", border: "1px solid var(--border)", borderRight: "none", borderRadius: "var(--radius) 0 0 var(--radius)", padding: "10px 10px", fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", whiteSpace: "nowrap" };
const hintStyle: React.CSSProperties = { fontSize: "12px", color: "var(--text-muted)" };
const actions: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "4px" };
const cancelBtn: React.CSSProperties = { padding: "9px 16px", borderRadius: "var(--radius)", fontSize: "13px", fontWeight: "500", color: "var(--text-secondary)", background: "transparent", border: "1px solid var(--border)" };
const submitBtn: React.CSSProperties = { padding: "9px 20px", borderRadius: "var(--radius)", fontSize: "13px", fontWeight: "600", color: "var(--text-inverse)", background: "var(--accent)", border: "none", cursor: "pointer" };
const errorBox: React.CSSProperties = { background: "var(--danger-muted)", border: "1px solid var(--danger)", borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "var(--danger)", fontSize: "13px" };
const upgradeBox: React.CSSProperties = { background: "var(--accent-muted)", border: "1px solid var(--accent-hover)", borderRadius: "var(--radius)", padding: "16px 18px" };
const upgradeLink: React.CSSProperties = { display: "inline-block", background: "var(--accent)", color: "var(--text-inverse)", padding: "8px 16px", borderRadius: "var(--radius-sm)", fontSize: "13px", fontWeight: "600", textDecoration: "none" };
