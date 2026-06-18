import { createContext, useContext } from "react";
import type { CampaignTheme } from "@/lib/campaign-engine/theme";
import { resolveFontFamily } from "@/lib/campaign-engine/theme";

export const CampaignThemeContext = createContext<CampaignTheme | null>(null);
export function useCampaignTheme() {
  return useContext(CampaignThemeContext);
}

const RADII: Record<string, { btn: string; card: string }> = {
  sharp:   { btn: "3px",   card: "2px"  },
  default: { btn: "999px", card: "8px"  },
  rounded: { btn: "999px", card: "20px" },
};

/** Derive inline-style override objects from a CampaignTheme.
 *  Returns null for unset fields so spreads resolve to nothing. */
export function computeCampaignStyles(theme: CampaignTheme | null) {
  const font = resolveFontFamily(theme?.fontFamily ?? null);
  const r = RADII[theme?.radiusStyle ?? "default"];

  return {
    action: theme?.accentColor
      ? { backgroundColor: theme.accentColor, borderColor: theme.accentColor }
      : null,
    canvas: theme?.bgColor
      ? { backgroundColor: theme.bgColor }
      : null,
    surface: theme?.surfaceColor
      ? { backgroundColor: theme.surfaceColor }
      : null,
    text: (theme?.textColor || font)
      ? {
          ...(theme?.textColor ? { color: theme.textColor } : {}),
          ...(font ? { fontFamily: font } : {}),
        }
      : null,
    font: font ? { fontFamily: font } : null,
    btnRadius: { borderRadius: r.btn },
    cardRadius: { borderRadius: r.card },
  };
}

export type CampaignStyles = ReturnType<typeof computeCampaignStyles>;
