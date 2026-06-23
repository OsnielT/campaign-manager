"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAudienceFields, BUILT_IN_TOKENS } from "@/lib/builder/audience-fields-context";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}

const ALL_CONTEXT_TOKENS = BUILT_IN_TOKENS;

/** Textarea with a `{{` trigger dropdown for inserting template tokens */
export function TemplateTextField({ value, onChange, placeholder, rows = 3 }: Props) {
  const { fields } = useAudienceFields();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const lastTriggerIdx = useRef<number>(-1);

  const recordTokens = fields.map((f) => ({
    token: `{{record.${f.key}}}`,
    label: f.label,
    example: "",
  }));

  const allTokens = [...recordTokens, ...ALL_CONTEXT_TOKENS];

  function handleKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    const cursor = ta.selectionStart ?? 0;
    const textBefore = ta.value.slice(0, cursor);
    const triggerIdx = textBefore.lastIndexOf("{{");
    if (triggerIdx !== -1 && triggerIdx >= textBefore.length - 10) {
      lastTriggerIdx.current = triggerIdx;
      // Compute position below cursor
      const rect = ta.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + 4, left: rect.left });
      setShowPicker(true);
    } else {
      setShowPicker(false);
      lastTriggerIdx.current = -1;
    }
  }

  function insertToken(token: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? 0;
    const textBefore = ta.value.slice(0, cursor);
    const triggerIdx = lastTriggerIdx.current >= 0 ? lastTriggerIdx.current : textBefore.lastIndexOf("{{");
    const before = triggerIdx >= 0 ? ta.value.slice(0, triggerIdx) : ta.value.slice(0, cursor);
    const after = ta.value.slice(cursor);
    onChange(before + token + after);
    setShowPicker(false);
    lastTriggerIdx.current = -1;
    // Refocus
    setTimeout(() => {
      ta.focus();
      const pos = before.length + token.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    function onMouseDown(e: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        e.target !== textareaRef.current
      ) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [showPicker]);

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={textareaRef}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onKeyUp={handleKeyUp}
        placeholder={placeholder ?? "Type text… use {{ to insert a variable"}
        rows={rows}
        style={{
          width: "100%",
          background: "var(--bg-surface, #fff)",
          border: "1px solid var(--border, #c7c4d8)",
          borderRadius: "var(--radius-sm, 4px)",
          padding: "6px 8px",
          fontSize: 12,
          fontFamily: "inherit",
          color: "var(--text-primary, #131b2e)",
          resize: "vertical",
          boxSizing: "border-box",
          lineHeight: 1.5,
        }}
      />
      <div style={{ marginTop: 3, fontSize: 10, color: "var(--text-muted, #777587)" }}>
        Type <code style={{ background: "var(--bg-raised,#f2f3ff)", padding: "0 3px", borderRadius: 2 }}>{"{{"}field{"}}"}  </code> to insert a variable
      </div>
      {showPicker && allTokens.length > 0 && (
        <div
          ref={pickerRef}
          style={{
            position: "fixed",
            top: pickerPos.top,
            left: pickerPos.left,
            zIndex: 99999,
            background: "var(--bg-surface, #fff)",
            border: "1px solid var(--border, #c7c4d8)",
            borderRadius: "var(--radius, 8px)",
            boxShadow: "0 8px 24px rgba(19,27,46,0.14)",
            minWidth: 220,
            maxHeight: 240,
            overflowY: "auto",
            padding: "4px 0",
          }}
        >
          {allTokens.map(({ token, label }) => (
            <button
              key={token}
              onMouseDown={(e) => { e.preventDefault(); insertToken(token); }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                width: "100%",
                padding: "6px 12px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                gap: 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-raised, #f2f3ff)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary, #131b2e)" }}>{label}</span>
              <code style={{ fontSize: 10, color: "var(--accent, #3525cd)", opacity: 0.8 }}>{token}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Puck custom-field render wrapper */
export function renderTemplateTextField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: string) => void;
}) {
  return <TemplateTextField value={(value as string) ?? ""} onChange={onChange} />;
}
