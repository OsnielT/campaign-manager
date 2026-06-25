"use client";

import { useEffect } from "react";

/**
 * Guarantees the double-submit CSRF cookie exists on every admin page, so the
 * first mutating request (e.g. creating a campaign) always has a matching token
 * even if the user navigated straight here without hitting an endpoint that
 * seeds it server-side. Safe: the cookie is SameSite=Strict, so a cross-site
 * attacker can neither read it nor send it.
 */
export function EnsureCsrf() {
  useEffect(() => {
    const has = document.cookie.split("; ").some((c) => c.startsWith("primitive_csrf="));
    if (has) return;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
    document.cookie = `primitive_csrf=${token}; path=/; SameSite=Strict`;
  }, []);
  return null;
}
