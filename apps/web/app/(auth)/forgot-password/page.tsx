"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { authStyles as s } from "@/components/auth/styles";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <>
        <h1 style={s.heading}>Check your email</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.7" }}>
          If that address is registered, we sent a reset link. It expires in 1 hour.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 style={s.heading}>Reset password</h1>
      <form onSubmit={handleSubmit} style={s.form}>
        <label style={s.label}>
          Email
          <input
            style={s.input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button style={s.button} type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p style={s.footer}>
        <Link href="/login" style={s.link}>
          Back to sign in
        </Link>
      </p>
    </>
  );
}
