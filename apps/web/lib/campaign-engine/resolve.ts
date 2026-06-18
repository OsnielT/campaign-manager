/**
 * Shared campaign resolution logic for both the entry page and sub-pages.
 * Returns the resolved campaign, org, page, and composition — or a redirect/
 * notFound action to perform.
 */
import { db } from "@/lib/db";
import { organizations, campaigns, campaignPages, campaignPageCompositions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { CampaignTheme } from "@/lib/campaign-engine/theme";

export type ResolveResult =
  | { action: "not_found" }
  | { action: "redirect"; url: string }
  | {
      action: "render";
      org: { id: string; slug: string; name: string; branding: CampaignTheme | null };
      campaign: {
        id: string;
        slug: string;
        name: string;
        status: string;
        expiresAt: Date | null;
        expiryRedirectUrl: string | null;
        expiryPageTree: unknown;
        theme: CampaignTheme | null;
      };
      page: {
        id: string;
        title: string;
        path: string;
        isEntry: boolean;
        isConversionPage: boolean;
        metaTitle: string | null;
        metaDescription: string | null;
      };
      treeJson: unknown;
    }
  | {
      action: "expired";
      campaign: {
        id: string;
        name: string;
        expiryRedirectUrl: string | null;
        expiryPageTree: unknown;
      };
    };

export async function resolveCampaignPage(
  orgSlug: string,
  campaignSlug: string,
  pagePath: string // e.g. "/" or "/thank-you"
): Promise<ResolveResult> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgSlug),
    columns: { id: true, slug: true, name: true, branding: true },
  });
  if (!org) return { action: "not_found" };

  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.orgId, org.id), eq(campaigns.slug, campaignSlug)),
  });
  if (!campaign) return { action: "not_found" };

  // Status gating
  if (campaign.status === "draft" || campaign.status === "scheduled") {
    return { action: "not_found" };
  }

  if (campaign.status === "expired") {
    if (campaign.expiryRedirectUrl) {
      return { action: "redirect", url: campaign.expiryRedirectUrl };
    }
    return {
      action: "expired",
      campaign: {
        id: campaign.id,
        name: campaign.name,
        expiryRedirectUrl: campaign.expiryRedirectUrl,
        expiryPageTree: campaign.expiryPageTree,
      },
    };
  }

  // Normalize path — always starts with /
  const normalizedPath = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;

  const page = await db.query.campaignPages.findFirst({
    where: and(
      eq(campaignPages.campaignId, campaign.id),
      eq(campaignPages.path, normalizedPath)
    ),
    columns: {
      id: true,
      title: true,
      path: true,
      isEntry: true,
      isConversionPage: true,
      metaTitle: true,
      metaDescription: true,
    },
  });
  if (!page) return { action: "not_found" };

  const composition = await db.query.campaignPageCompositions.findFirst({
    where: eq(campaignPageCompositions.campaignPageId, page.id),
    columns: { treeJson: true },
  });

  return {
    action: "render",
    org: { id: org.id, slug: org.slug, name: org.name, branding: (org.branding as CampaignTheme | null) ?? null },
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      name: campaign.name,
      status: campaign.status,
      expiresAt: campaign.expiresAt,
      expiryRedirectUrl: campaign.expiryRedirectUrl,
      expiryPageTree: campaign.expiryPageTree,
      theme: (campaign.theme as CampaignTheme | null) ?? null,
    },
    page,
    treeJson: composition?.treeJson ?? null,
  };
}
