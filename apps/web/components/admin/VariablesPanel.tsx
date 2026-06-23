"use client";

import React, { useState } from "react";
import { useAudienceFields, BUILT_IN_TOKENS } from "@/lib/builder/audience-fields-context";
import { Copy, Check, ChevronDown, ChevronRight, Variable } from "lucide-react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy token"
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 22, height: 22, padding: 0, flexShrink: 0,
        background: copied ? "var(--success-muted, #0a7d4f14)" : "var(--bg-raised, #f2f3ff)",
        border: "1px solid var(--border, #c7c4d8)",
        borderRadius: "var(--radius-sm, 4px)",
        cursor: "pointer",
        color: copied ? "var(--success, #0a7d4f)" : "var(--text-muted, #777587)",
        transition: "background 0.12s, color 0.12s",
      }}
    >
      {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} strokeWidth={1.8} />}
    </button>
  );
}

function TokenRow({ token, label }: { token: string; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "4px 0",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary, #131b2e)", marginBottom: 1 }}>
          {label}
        </div>
        <code style={{
          fontSize: 10,
          color: "var(--accent, #3525cd)",
          background: "var(--accent-muted, #3525cd14)",
          padding: "1px 4px",
          borderRadius: 3,
          display: "inline-block",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {token}
        </code>
      </div>
      <CopyButton text={token} />
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 4, width: "100%",
          background: "none", border: "none", cursor: "pointer",
          padding: "5px 0", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          color: "var(--text-secondary, #464555)", textTransform: "uppercase",
        }}
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {title}
      </button>
      {open && (
        <div style={{ paddingLeft: 4 }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function VariablesPanel() {
  const { fields, previewMode, setPreviewMode } = useAudienceFields();

  const recordTokens = fields.map((f) => ({
    token: `{{record.${f.key}}}`,
    label: f.label,
  }));

  return (
    <div style={{
      borderTop: "1px solid var(--border, #c7c4d8)",
      padding: "10px 12px",
      background: "var(--bg-surface, #fff)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Variable size={13} strokeWidth={1.8} style={{ color: "var(--accent, #3525cd)" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary, #131b2e)" }}>
            Variables
          </span>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
          <span style={{ fontSize: 10, color: "var(--text-muted, #777587)" }}>Preview</span>
          <div
            onClick={() => setPreviewMode(!previewMode)}
            style={{
              width: 28, height: 16, borderRadius: 8, position: "relative", cursor: "pointer",
              background: previewMode ? "var(--accent, #3525cd)" : "var(--border, #c7c4d8)",
              transition: "background 0.15s",
            }}
          >
            <div style={{
              position: "absolute", top: 2, left: previewMode ? 14 : 2,
              width: 12, height: 12, borderRadius: "50%",
              background: "#fff", transition: "left 0.15s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </div>
        </label>
      </div>

      {recordTokens.length > 0 && (
        <Section title="Audience record">
          {recordTokens.map(({ token, label }) => (
            <TokenRow key={token} token={token} label={label} />
          ))}
        </Section>
      )}

      <Section title="Context & URL" defaultOpen={false}>
        {BUILT_IN_TOKENS.map(({ token, label }) => (
          <TokenRow key={token} token={token} label={label} />
        ))}
      </Section>

      <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted, #777587)", lineHeight: 1.5 }}>
        Syntax: <code style={{ fontSize: 9 }}>{"{{record.field|capitalize|Fallback}}"}</code>
      </div>
    </div>
  );
}
