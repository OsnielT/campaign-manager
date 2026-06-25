"use client";

import { useState, FormEvent, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authStyles as s } from "@/components/auth/styles";

export default function ResetPasswordPage() {
  // useSearchParams requires a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={<h1 style={s.heading}>New password</h1>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reset failed");
        return;
      }
      router.push("/login?reset=1");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 style={s.heading}>New password</h1>
      <form onSubmit={handleSubmit} style={s.form}>
        {error && <p style={s.errorBox}>{error}</p>}
        <label style={s.label}>
          New password
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
        <label style={s.label}>
          Confirm password
          <input
            style={s.input}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button style={s.button} type="submit" disabled={loading}>
          {loading ? "Saving…" : "Set new password"}
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
