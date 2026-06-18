import type { CSSProperties } from "react";

export const authStyles = {
  heading: {
    fontSize: "20px",
    fontWeight: "600",
    color: "var(--text-primary)",
    marginBottom: "24px",
    letterSpacing: "-0.3px",
  } satisfies CSSProperties,

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  } satisfies CSSProperties,

  label: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "13px",
    fontWeight: "500",
    color: "var(--text-secondary)",
    letterSpacing: "0.02em",
  } satisfies CSSProperties,

  input: {
    background: "var(--bg-raised)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "10px 12px",
    color: "var(--text-primary)",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.15s",
    width: "100%",
  } satisfies CSSProperties,

  button: {
    marginTop: "4px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius)",
    padding: "11px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background 0.15s",
    width: "100%",
    letterSpacing: "0.01em",
  } satisfies CSSProperties,

  errorBox: {
    background: "#f8717115",
    border: "1px solid #f87171",
    borderRadius: "var(--radius-sm)",
    padding: "10px 12px",
    color: "var(--danger)",
    fontSize: "13px",
  } satisfies CSSProperties,

  footer: {
    marginTop: "20px",
    fontSize: "13px",
    color: "var(--text-secondary)",
    textAlign: "center",
  } satisfies CSSProperties,

  forgotRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "-8px",
  } satisfies CSSProperties,

  link: {
    color: "var(--accent-hover)",
    fontSize: "13px",
    fontWeight: "500",
  } satisfies CSSProperties,
};
