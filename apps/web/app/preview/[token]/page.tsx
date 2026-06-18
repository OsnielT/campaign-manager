import { notFound } from "next/navigation";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { campaignPreviewTokens, campaigns, campaignPages, campaignPageCompositions, organizations } from "@/lib/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { CampaignPageShell } from "@/components/public/CampaignPageShell";
import { resolveBrand, type CampaignTheme } from "@/lib/campaign-engine/theme";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ pageId?: string }>;
}

export default async function PreviewPage({ params, searchParams }: Props) {
  const [{ token }, { pageId: requestedPageId }] = await Promise.all([params, searchParams]);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();

  // Find a valid, non-expired, non-revoked token
  const previewToken = await db.query.campaignPreviewTokens.findFirst({
    where: and(
      eq(campaignPreviewTokens.tokenHash, tokenHash),
      isNull(campaignPreviewTokens.revokedAt),
      gt(campaignPreviewTokens.expiresAt, now)
    ),
    with: {
      campaign: {
        with: {
          pages: {
            orderBy: (p, { asc }) => [asc(p.position)],
          },
        },
      },
    },
  });

  if (!previewToken) notFound();

  const campaign = previewToken.campaign;

  // Use requested page if valid and belongs to this campaign, otherwise fall back to entry
  const targetPage = requestedPageId
    ? campaign.pages.find((p) => p.id === requestedPageId)
    : undefined;
  const entryPage = targetPage ?? campaign.pages.find((p) => p.isEntry) ?? campaign.pages[0];
  if (!entryPage) notFound();

  // Load the page composition
  const composition = await db.query.campaignPageCompositions.findFirst({
    where: eq(campaignPageCompositions.campaignPageId, entryPage.id),
  });

  // Get org slug for context
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, campaign.orgId),
    columns: { slug: true, name: true, branding: true },
  });

  const treeJson = (composition?.treeJson ?? []) as Parameters<typeof CampaignPageShell>[0]["data"];

  const ctx = {
    sessionId: null,
    orgSlug: org?.slug ?? "",
    campaignSlug: campaign.slug,
    pageTitle: entryPage.title,
    pagePath: entryPage.path,
    formData: {},
    audienceRecord: null,
  };

  return (
    <>
      {/* Preview banner */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
        background: "#7c5af3", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 10, padding: "8px 16px", fontSize: 13, fontWeight: 500,
      }}>
        <span style={{ opacity: 0.8 }}>🔒</span>
        <span>
          <strong>Preview mode</strong> — this is a private draft of &ldquo;{campaign.name}&rdquo;. Not yet published.
        </span>
        <span style={{ opacity: 0.7, fontSize: 12 }}>
          Expires {new Date(previewToken.expiresAt).toLocaleDateString()}
        </span>
      </div>
      {/* Spacer for the banner */}
      <div style={{ height: 40 }} />
      <CampaignPageShell
        data={treeJson}
        ctx={ctx}
        urlParams={{}}
        theme={resolveBrand((org?.branding as CampaignTheme | null) ?? null, campaign.theme as CampaignTheme | null)}
      />
    </>
  );
}
