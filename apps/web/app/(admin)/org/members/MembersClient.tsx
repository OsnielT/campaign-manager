"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, UserPlus, Send, TrendingUp } from "lucide-react";

interface Member {
  id: string;
  role: string;
  joinedAt: Date;
  userId: string;
  name: string;
  email: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
}

function getCsrf() {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("primitive_csrf="))
      ?.split("=")[1] ?? ""
  );
}

export function MembersClient({
  orgId,
  members: initialMembers,
  pendingInvites: initialInvites,
  isOwner,
  currentUserId,
  plan,
}: {
  orgId: string;
  members: Member[];
  pendingInvites: Invite[];
  isOwner: boolean;
  currentUserId: string;
  plan: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) setInviteError("PLAN_LIMIT");
        else setInviteError(data.error ?? "Failed to send invite");
        return;
      }
      setInviteEmail("");
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 3000);
      router.refresh();
    } finally {
      setInviteLoading(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    await fetch(`/api/orgs/${orgId}/invites`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ inviteId }),
    });
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }

  async function removeMember(targetUserId: string) {
    const res = await fetch(`/api/orgs/${orgId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ targetUserId }),
    });
    if (res.ok) setMembers((prev) => prev.filter((m) => m.userId !== targetUserId));
  }

  const ROLE_STYLES: Record<string, React.CSSProperties> = {
    owner:  { color: "var(--accent)",   background: "var(--accent-muted)" },
    editor: { color: "var(--success)",  background: "var(--success-muted)" },
    viewer: { color: "var(--warning)",  background: "var(--warning-muted)" },
  };

  return (
    <div style={stack}>
      {/* Members table */}
      <div style={card}>
        <h2 style={cardHeading}>Current members</h2>
        <table style={table}>
          <thead>
            <tr>
              {["Name", "Email", "Role", "Joined", ""].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} style={tr}>
                <td style={td}>{m.name}</td>
                <td style={{ ...td, color: "var(--text-secondary)" }}>{m.email}</td>
                <td style={td}>
                  <span style={{ ...roleBadge, ...(ROLE_STYLES[m.role] ?? { color: "var(--text-muted)", background: "var(--bg-raised)" }) }}>
                    {m.role}
                  </span>
                </td>
                <td style={{ ...td, color: "var(--text-muted)", fontSize: "12px" }}>
                  {new Date(m.joinedAt).toLocaleDateString()}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {isOwner && m.userId !== currentUserId && m.role !== "owner" && (
                    <button style={removeBtn} onClick={() => removeMember(m.userId)}>
                      <UserMinus size={13} />
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div style={card}>
          <h2 style={cardHeading}>Pending invites</h2>
          <table style={table}>
            <thead>
              <tr>
                {["Email", "Role", "Expires", ""].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id} style={tr}>
                  <td style={td}>{inv.email}</td>
                  <td style={td}>
                    <span style={{ ...roleBadge, ...(ROLE_STYLES[inv.role] ?? { color: "var(--text-muted)", background: "var(--bg-raised)" }) }}>
                      {inv.role}
                    </span>
                  </td>
                  <td style={{ ...td, color: "var(--text-muted)", fontSize: "12px" }}>
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {isOwner && (
                      <button style={removeBtn} onClick={() => revokeInvite(inv.id)}>
                        <UserMinus size={13} />
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite form */}
      {isOwner && (
        <div style={card}>
          <h2 style={cardHeading}>Invite member</h2>
          <form onSubmit={handleInvite} style={form}>
            {inviteError === "PLAN_LIMIT" ? (
              <div style={planLimitBox}>
                <span style={{ fontWeight: 600 }}>Member limit reached.</span>
                {" "}
                <a href="/org/settings" style={{ color: "var(--accent)", fontWeight: 600 }}>
                  <TrendingUp size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Upgrade your plan
                </a>
              </div>
            ) : inviteError ? (
              <p style={errMsg}>{inviteError}</p>
            ) : null}
            {inviteSent && <p style={successMsg}>Invite sent successfully.</p>}
            <div style={formRow}>
              <input
                style={inputStyle}
                type="email"
                placeholder="colleague@company.com"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <select
                style={selectStyle}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button style={submitBtn} type="submit" disabled={inviteLoading}>
                {inviteLoading ? "Sending…" : <><Send size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />Send invite</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const stack: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "20px" };
const card: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "20px 20px 0",
  overflow: "hidden",
};
const cardHeading: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "600",
  color: "var(--text-secondary)",
  letterSpacing: "0.04em",
  marginBottom: "14px",
};
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const th: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: "600",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  borderTop: "1px solid var(--border-subtle)",
  background: "var(--bg-raised)",
};
const tr: React.CSSProperties = { borderTop: "1px solid var(--border-subtle)" };
const td: React.CSSProperties = { padding: "12px 12px", fontSize: "13px", color: "var(--text-primary)" };
const roleBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 7px",
  borderRadius: "99px",
  fontSize: "11px",
  fontWeight: "600",
  letterSpacing: "0.04em",
};
const removeBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  background: "transparent",
  border: "none",
  color: "var(--danger)",
  fontSize: "12px",
  cursor: "pointer",
  fontWeight: "500",
};
const form: React.CSSProperties = { paddingBottom: "20px" };
const formRow: React.CSSProperties = { display: "flex", gap: "8px", alignItems: "center" };
const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "9px 12px",
  color: "var(--text-primary)",
  fontSize: "13px",
};
const selectStyle: React.CSSProperties = {
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "9px 10px",
  color: "var(--text-primary)",
  fontSize: "13px",
  cursor: "pointer",
};
const submitBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--text-inverse)",
  border: "none",
  borderRadius: "var(--radius)",
  padding: "9px 16px",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const errMsg: React.CSSProperties = {
  color: "var(--danger)",
  fontSize: "12px",
  marginBottom: "8px",
  background: "var(--danger-muted)",
  padding: "6px 8px",
  borderRadius: "4px",
};
const successMsg: React.CSSProperties = {
  color: "var(--success)",
  fontSize: "12px",
  marginBottom: "8px",
  background: "var(--success-muted)",
  padding: "6px 8px",
  borderRadius: "4px",
};

const planLimitBox: React.CSSProperties = {
  background: "var(--accent-muted)",
  border: "1px solid var(--accent-hover)",
  borderRadius: "var(--radius-sm)",
  padding: "10px 12px",
  fontSize: "13px",
  color: "var(--text-secondary)",
  marginBottom: "8px",
};
