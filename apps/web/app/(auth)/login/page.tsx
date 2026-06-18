"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authStyles as s } from "@/components/auth/styles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const csrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("primitive_csrf="))
        ?.split("=")[1] ?? "";

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.reason === "unverified") {
          setError("Please verify your email before signing in.");
        } else {
          setError(data.error ?? "Sign in failed");
        }
        return;
      }
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 style={s.heading}>Sign in</h1>
      <form onSubmit={handleSubmit} style={s.form}>
        {error && <p style={s.errorBox}>{error}</p>}
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
        <label style={s.label}>
          Password
          <input
            style={s.input}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <div style={s.forgotRow}>
          <Link href="/forgot-password" style={s.link}>
            Forgot password?
          </Link>
        </div>
        <button style={s.button} type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p style={s.footer}>
        No account?{" "}
        <Link href="/signup" style={s.link}>
          Create one
        </Link>
      </p>
    </>
  );
}
