"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authStyles as s } from "@/components/auth/styles";

export default function VerifyEmailPage() {
  // useSearchParams requires a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={<p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Loading…</p>}>
      <VerifyEmail />
    </Suspense>
  );
}

function VerifyEmail() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"pending" | "verifying" | "success" | "error">(
    token ? "verifying" : "pending"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setStatus("success");
          setTimeout(() => router.push("/onboarding"), 1500);
        } else {
          setStatus("error");
          setError(data.error ?? "Verification failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("An unexpected error occurred");
      });
  }, [token, router]);

  if (status === "pending") {
    return (
      <>
        <h1 style={s.heading}>Check your email</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.7" }}>
          We sent a verification link to your email address. Click it to continue.
        </p>
      </>
    );
  }

  if (status === "verifying") {
    return <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Verifying…</p>;
  }

  if (status === "success") {
    return (
      <>
        <h1 style={s.heading}>Email verified</h1>
        <p style={{ color: "var(--success)", fontSize: "14px" }}>
          Redirecting to onboarding…
        </p>
      </>
    );
  }

  return (
    <>
      <h1 style={s.heading}>Verification failed</h1>
      <p style={s.errorBox}>{error}</p>
      <p style={{ ...s.footer, marginTop: "16px" }}>
        <Link href="/login" style={s.link}>
          Back to sign in
        </Link>
      </p>
    </>
  );
}
