"use client";

import { useEffect, useState } from "react";
import { PrimitiveRenderer, type RendererContext } from "./PrimitiveRenderer";
import { buildThemeVars, resolveFontFamily, FONT_OPTIONS, type CampaignTheme } from "@/lib/campaign-engine/theme";
import { CampaignThemeContext } from "@/lib/builder/campaign-theme-context";

interface Props {
  data: Parameters<typeof PrimitiveRenderer>[0]["data"];
  ctx: RendererContext;
  urlParams: Record<string, string>;
  theme: CampaignTheme | null;
}

/**
 * Wraps PrimitiveRenderer with:
 * 1. Lazy session cookie initialization for new visitors
 * 2. Campaign theme CSS variable injection on the root wrapper
 * 3. Optional logo rendering above the page content
 */
export function CampaignPageShell({ data, ctx, urlParams, theme }: Props) {
  const [sessionId, setSessionId] = useState(ctx.sessionId);

  // Initialize session for new visitors (cookie writes require a Route Handler)
  useEffect(() => {
    if (sessionId) return;
    let cancelled = false;
    fetch(`/api/public/${ctx.orgSlug}/${ctx.campaignSlug}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urlParams }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body?.sessionId) setSessionId(body.sessionId);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sessionId, ctx.orgSlug, ctx.campaignSlug, urlParams]);

  // Inject Google Font if needed
  useEffect(() => {
    if (!theme?.fontFamily) return;
    const font = FONT_OPTIONS.find((f) => f.key === theme.fontFamily);
    if (!font?.googleFont) return;
    const id = `campaign-font-${font.key}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${font.googleFont}&display=swap`;
    document.head.appendChild(link);
  }, [theme?.fontFamily]);

  const themeVars = theme ? buildThemeVars(theme) : {};
  const fontFamily = resolveFontFamily(theme?.fontFamily ?? null);

  return (
    <CampaignThemeContext.Provider value={theme}>
      <div style={{
        ...themeVars,
        ...(fontFamily ? { fontFamily } : {}),
        ...(theme?.textColor ? { color: theme.textColor } : {}),
      }}>
        {theme?.logoUrl && (
          <div style={{ padding: "16px 24px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={theme.logoUrl} alt="Logo" style={{ height: 40, objectFit: "contain", display: "block" }} />
          </div>
        )}
        <PrimitiveRenderer data={data} ctx={{ ...ctx, sessionId }} />
      </div>
    </CampaignThemeContext.Provider>
  );
}
