"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("primitive_csrf="))?.split("=")[1] ?? "";
}

interface Broadcast {
  id: string; name: string; subject: string; status: string;
  recipientCount: number; sentCount: number; failedCount: number;
  scheduledAt: string | null; sentAt: string | null; createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  draft: "var(--text-muted)", scheduled: "var(--warning)", sending: "var(--accent)",
  sent: "var(--success)", failed: "var(--danger)",
};

export function EmailListClient({ campaignSlug, canEdit }: { campaignSlug: string; canEdit: boolean }) {
  const router = useRouter();
  const [list, setList] = useState<Broadcast[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(`/api/campaigns/${campaignSlug}/broadcasts`).then((r) => r.json()).then((d) => setList(d.broadcasts ?? [])).catch(() => setList([]));
  }, [campaignSlug]);

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignSlug}/broadcasts`, { method: "POST", headers: { "x-csrf-token": getCsrf() } });
      const { broadcast } = await res.json();
      if (broadcast?.id) router.push(`/campaigns/${campaignSlug}/email/${broadcast.id}`);
    } finally { setCreating(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Email broadcasts</h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>Design and send emails to this campaign’s audience.</p>
        </div>
        {canEdit && (
          <button onClick={create} disabled={creating} style={primaryBtn}>{creating ? "Creating…" : "New broadcast"}</button>
        )}
      </div>

      {list === null && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
      {list && list.length === 0 && (
        <div style={emptyCard}>No broadcasts yet. {canEdit && "Create your first one."}</div>
      )}
      {list && list.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((b) => (
            <Link key={b.id} href={`/campaigns/${campaignSlug}/email/${b.id}`} style={row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name || "Untitled broadcast"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.subject || "No subject"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                {b.status === "sent" && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{b.sentCount} sent{b.failedCount ? ` · ${b.failedCount} failed` : ""}</span>}
                {b.status === "scheduled" && b.scheduledAt && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(b.scheduledAt).toLocaleString()}</span>}
                <span style={{ ...badge, color: STATUS_COLOR[b.status] ?? "var(--text-muted)", borderColor: STATUS_COLOR[b.status] ?? "var(--border)" }}>{b.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const primaryBtn: React.CSSProperties = { background: "var(--accent)", color: "var(--text-inverse)", border: "none", borderRadius: "var(--radius-sm)", padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const emptyCard: React.CSSProperties = { padding: 40, textAlign: "center", color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "14px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", textDecoration: "none", color: "var(--text-primary)" };
const badge: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", border: "1px solid", borderRadius: 99, padding: "2px 9px" };
