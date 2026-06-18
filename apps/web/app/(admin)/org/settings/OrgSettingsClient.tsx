"use client";

import { useState, useRef, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BrandingEditor } from "@/components/branding/BrandingEditor";
import { NEUTRAL_LIGHT_BRAND, type CampaignTheme } from "@/lib/campaign-engine/theme";

interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
  stripeCustomerId: string | null;
  branding: CampaignTheme | null;
}

function getCsrf() {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("primitive_csrf="))
      ?.split("=")[1] ?? ""
  );
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

export function OrgSettingsClient({ org, isOwner }: { org: Org; isOwner: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  // Org branding — debounced auto-save.
  const [branding, setBranding] = useState<CampaignTheme>(org.branding ?? NEUTRAL_LIGHT_BRAND);
  const [brandSaved, setBrandSaved] = useState(false);
  const brandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveBranding = useCallback((b: CampaignTheme) => {
    if (brandTimer.current) clearTimeout(brandTimer.current);
    brandTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/orgs/${org.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ branding: b }),
      });
      if (res.ok) { setBrandSaved(true); setTimeout(() => setBrandSaved(false), 2000); }
    }, 700);
  }, [org.id]);

  async function handleUpgrade(plan: "pro" | "enterprise") {
    setBillingLoading(true);
    try {
      const res = await fetch(`/api/orgs/${org.id}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setBillingLoading(false);
    }
  }

  async function handlePortal() {
    setBillingLoading(true);
    try {
      const res = await fetch(`/api/orgs/${org.id}/billing/portal`, {
        method: "POST",
        headers: { "x-csrf-token": getCsrf() },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${org.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error ?? "Failed to save");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={stack}>
      {/* Plan */}
      <div style={card}>
        <h2 style={cardHeading}>Plan</h2>
        <div style={planRow}>
          <div>
            <p style={planName}>{PLAN_LABELS[org.plan] ?? org.plan}</p>
            <p style={planNote}>
              {org.plan === "free"
                ? "3 campaigns · 1 member"
                : org.plan === "pro"
                ? "50 campaigns · 15 members"
                : "Unlimited"}
            </p>
          </div>
          {isOwner && org.plan === "free" && (
            <button
              style={{ ...upgradeBtn, opacity: billingLoading ? 0.6 : 1 }}
              disabled={billingLoading}
              onClick={() => handleUpgrade("pro")}
            >
              {billingLoading ? "Loading…" : "Upgrade to Pro"}
            </button>
          )}
          {isOwner && org.plan !== "free" && (
            <button
              style={{ ...upgradeBtn, background: "var(--bg-raised)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              disabled={billingLoading}
              onClick={handlePortal}
            >
              {billingLoading ? "Loading…" : "Manage billing"}
            </button>
          )}
        </div>
      </div>

      {/* Org name */}
      <div style={card}>
        <h2 style={cardHeading}>General</h2>
        <form onSubmit={handleSave} style={form}>
          {saveError && <p style={errMsg}>{saveError}</p>}
          {saved && <p style={successMsg}>Saved.</p>}
          <label style={labelStyle}>
            Organization name
            <input
              style={inputStyle}
              type="text"
              required
              value={name}
              disabled={!isOwner}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Slug
            <input style={{ ...inputStyle, color: "var(--text-muted)" }} type="text" disabled value={org.slug} />
            <span style={hint}>Slug cannot be changed after creation.</span>
          </label>
          {isOwner && (
            <div style={actions}>
              <button style={saveBtn} type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Branding — the org default brand campaigns inherit */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ ...cardHeading, marginBottom: 0 }}>Branding</h2>
          {brandSaved && <span style={{ fontSize: 12, color: "var(--success)" }}>Saved</span>}
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
          Your default brand. New campaigns inherit these; each campaign can override any field in its Branding tab.
        </p>
        {isOwner ? (
          <BrandingEditor value={branding} onChange={(b) => { setBranding(b); saveBranding(b); }} />
        ) : (
          <p style={hint}>Only owners can edit branding.</p>
        )}
      </div>
    </div>
  );
}

const stack: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "20px" };
const card: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "20px 24px",
};
const cardHeading: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: "600",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: "14px",
};
const planRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const planName: React.CSSProperties = { fontSize: "16px", fontWeight: "600", color: "var(--text-primary)" };
const planNote: React.CSSProperties = { fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" };
const upgradeBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--text-inverse)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
};
const form: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "16px" };
const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "13px",
  fontWeight: "500",
  color: "var(--text-secondary)",
};
const inputStyle: React.CSSProperties = {
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "9px 12px",
  color: "var(--text-primary)",
  fontSize: "14px",
};
const hint: React.CSSProperties = { fontSize: "12px", color: "var(--text-muted)" };
const actions: React.CSSProperties = { display: "flex", justifyContent: "flex-end" };
const saveBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--text-inverse)",
  border: "none",
  borderRadius: "var(--radius)",
  padding: "9px 20px",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
};
const errMsg: React.CSSProperties = {
  color: "var(--danger)",
  fontSize: "12px",
  background: "var(--danger-muted)",
  padding: "6px 8px",
  borderRadius: "4px",
};
const successMsg: React.CSSProperties = {
  color: "var(--success)",
  fontSize: "12px",
  background: "var(--success-muted)",
  padding: "6px 8px",
  borderRadius: "4px",
};
