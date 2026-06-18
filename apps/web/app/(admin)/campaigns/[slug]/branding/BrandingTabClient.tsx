"use client";

import { useState, useRef, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import { BrandingEditor } from "@/components/branding/BrandingEditor";
import { DEFAULT_THEME, type CampaignTheme } from "@/lib/campaign-engine/theme";

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("primitive_csrf="))?.split("=")[1] ?? "";
}

export function BrandingTabClient({
  campaignSlug,
  initialTheme,
  orgBranding,
}: {
  campaignSlug: string;
  initialTheme: CampaignTheme | null;
  orgBranding: CampaignTheme | null;
}) {
  // The campaign override layer; null fields inherit from org branding.
  const [theme, setTheme] = useState<CampaignTheme>(initialTheme ?? DEFAULT_THEME);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((t: CampaignTheme) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/campaigns/${campaignSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ theme: t }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    }, 700);
  }, [campaignSlug]);

  function applyOrgBrand() {
    // Clear every override so the campaign fully inherits the org brand.
    setTheme(DEFAULT_THEME);
    save(DEFAULT_THEME);
  }

  const hasOverrides = Object.values(theme).some((v) => v != null);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button
          type="button"
          onClick={applyOrgBrand}
          disabled={!hasOverrides}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "1px solid var(--border)", borderRadius: 8,
            padding: "6px 12px", fontSize: 12, color: hasOverrides ? "var(--text-secondary)" : "var(--text-muted)",
            cursor: hasOverrides ? "pointer" : "default",
          }}
        >
          <RotateCcw size={12} /> Reset to org brand
        </button>
        {saved && <span style={{ fontSize: 12, color: "var(--success)" }}>Saved</span>}
      </div>
      <BrandingEditor
        value={theme}
        inherited={orgBranding}
        onChange={(t) => { setTheme(t); save(t); }}
      />
    </div>
  );
}
