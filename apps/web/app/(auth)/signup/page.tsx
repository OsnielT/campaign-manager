"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authStyles as s } from "@/components/auth/styles";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Signup failed");
        return;
      }
      router.push("/verify-email");
    } finally {
      setLoading(false);
    }
  }

  const consentText: React.CSSProperties = {
    fontSize: "11px",
    color: "var(--text-muted)",
    textAlign: "center",
    marginTop: "10px",
    lineHeight: 1.5,
  };

  return (
    <>
      <h1 style={s.heading}>Create account</h1>
      <form onSubmit={handleSubmit} style={s.form}>
        {error && <p style={s.errorBox}>{error}</p>}
        <label style={s.label}>
          Name
          <input
            style={s.input}
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button style={s.button} type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>
        <p style={consentText}>
          By creating an account you agree to our{" "}
          <Link href="/terms" style={s.link}>Terms of Service</Link>{" "}
          and{" "}
          <Link href="/privacy" style={s.link}>Privacy Policy</Link>.
        </p>
      </form>
      <p style={s.footer}>
        Already have an account?{" "}
        <Link href="/login" style={s.link}>
          Sign in
        </Link>
      </p>
    </>
  );
}
