"use client";

import { useEffect } from "react";

/**
 * Fires a session-init POST on first render for new visitors.
 * The server component couldn't create the session because cookies can only
 * be written from Route Handlers, not during Server Component rendering.
 */
export function SessionInitializer({
  orgSlug,
  campaignSlug,
  urlParams,
}: {
  orgSlug: string;
  campaignSlug: string;
  urlParams: Record<string, string>;
}) {
  useEffect(() => {
    fetch(`/api/public/${orgSlug}/${campaignSlug}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urlParams }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
