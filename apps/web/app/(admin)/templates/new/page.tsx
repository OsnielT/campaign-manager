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

export default function NewTemplatePage() {
  const router = useRouter();
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
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ name, slug, isTemplate: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create template");
        return;
      }
      router.push(`/campaigns/${data.campaign.slug}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      <div style={breadcrumb}>
        <Link href="/templates" style={breadcrumbLink}>Templates</Link>
        <span style={breadcrumbSep}>/</span>
        <span style={breadcrumbCurrent}>New</span>
      </div>

      <h1 style={heading}>New template</h1>
      <p style={sub}>Give your template a name. You&apos;ll build it out in the campaign editor.</p>

      <div style={card}>
        <form onSubmit={handleSubmit} style={form}>
          {error && <p style={errorBox}>{error}</p>}

          <label style={label}>
            Template name
            <input
              style={input}
              type="text"
              required
              autoFocus
              placeholder="Product Launch Flow"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label style={label}>
            Slug
            <div style={slugRow}>
              <span style={slugPrefix}>templates/</span>
              <input
                style={{ ...input, borderRadius: "0 var(--radius) var(--radius) 0", flex: 1 }}
                type="text"
                required
                pattern="[a-z0-9-]+"
                placeholder="product-launch-flow"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                }}
              />
            </div>
            <span style={hint}>Lowercase letters, numbers, hyphens only.</span>
          </label>

          <div style={actions}>
            <Link href="/templates" style={cancelBtn}>Cancel</Link>
            <button style={submitBtn} type="submit" disabled={loading || !name || !slug}>
              {loading ? "Creating…" : "Create template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const page: React.CSSProperties = { padding: "32px 36px" };
const breadcrumb: React.CSSProperties = { display: "flex", alignItems: "center", gap: "6px", marginBottom: "20px", fontSize: "13px" };
const breadcrumbLink: React.CSSProperties = { color: "var(--text-secondary)" };
const breadcrumbSep: React.CSSProperties = { color: "var(--text-muted)" };
const breadcrumbCurrent: React.CSSProperties = { color: "var(--text-primary)" };
const heading: React.CSSProperties = { fontSize: "22px", fontWeight: "600", color: "var(--text-primary)", letterSpacing: "-0.4px", marginBottom: "6px" };
const sub: React.CSSProperties = { fontSize: "13px", color: "var(--text-secondary)", marginBottom: "24px" };
const card: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "28px", maxWidth: "480px" };
const form: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "20px" };
const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "500", color: "var(--text-secondary)" };
const input: React.CSSProperties = { background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px", color: "var(--text-primary)", fontSize: "14px", outline: "none" };
const slugRow: React.CSSProperties = { display: "flex", alignItems: "stretch" };
const slugPrefix: React.CSSProperties = { background: "var(--bg-raised)", border: "1px solid var(--border)", borderRight: "none", borderRadius: "var(--radius) 0 0 var(--radius)", padding: "10px 10px", fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", whiteSpace: "nowrap" };
const hint: React.CSSProperties = { fontSize: "12px", color: "var(--text-muted)" };
const actions: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "4px" };
const cancelBtn: React.CSSProperties = { padding: "9px 16px", borderRadius: "var(--radius)", fontSize: "13px", fontWeight: "500", color: "var(--text-secondary)", background: "transparent", border: "1px solid var(--border)" };
const submitBtn: React.CSSProperties = { padding: "9px 20px", borderRadius: "var(--radius)", fontSize: "13px", fontWeight: "600", color: "var(--text-inverse)", background: "var(--accent)", border: "none", cursor: "pointer" };
const errorBox: React.CSSProperties = { background: "var(--danger-muted)", border: "1px solid var(--danger)", borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "var(--danger)", fontSize: "13px" };
