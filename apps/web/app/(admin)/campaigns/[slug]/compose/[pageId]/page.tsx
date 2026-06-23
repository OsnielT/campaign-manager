import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { campaignPages, campaigns, campaignPageCompositions, orgMembers, organizations, campaignAudienceFields } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { BuilderClient } from "./BuilderClient";
import type { Data } from "@measured/puck";
import type { CampaignTheme } from "@/lib/campaign-engine/theme";

export type PageNavItem = {
  id: string;
  title: string;
  path: string;
  isEntry: boolean;
  isConversionPage: boolean;
  position: number;
};

// Full-screen builder — no admin shell wrapper
export const dynamic = "force-dynamic";

export default async function ComposePage({
  params,
}: {
  params: Promise<{ slug: string; pageId: string }>;
}) {
  const { slug, pageId } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const orgId = session.orgId!;
  const userId = session.userId!;

  const [page, membership] = await Promise.all([
    db.query.campaignPages.findFirst({
      where: eq(campaignPages.id, pageId),
      with: {
        campaign: { columns: { id: true, orgId: true, slug: true, name: true, theme: true } },
        composition: true,
      },
    }),
    db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    }),
  ]);

  if (!page) notFound();
  if (page.campaign.orgId !== orgId) notFound();
  if (page.campaign.slug !== slug) notFound();
  if (!membership) notFound();

  const [allPages, org, audienceFields] = await Promise.all([
    db.query.campaignPages.findMany({
      where: eq(campaignPages.campaignId, page.campaign.id),
      columns: { id: true, title: true, path: true, isEntry: true, isConversionPage: true, position: true },
      orderBy: (t, { asc }) => [asc(t.position)],
    }),
    db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { branding: true },
    }),
    db.query.campaignAudienceFields.findMany({
      where: eq(campaignAudienceFields.campaignId, page.campaign.id),
      columns: { key: true, label: true, generator: true },
      orderBy: (f, { asc }) => [asc(f.position)],
    }),
  ]);

  const canEdit = membership.role === "owner" || membership.role === "editor";

  // Deserialize stored Puck data or start with an empty canvas
  const initialData: Data = page.composition?.treeJson
    ? (page.composition.treeJson as Data)
    : { content: [], root: { props: { title: page.title } }, zones: {} };

  return (
    <BuilderClient
      pageId={pageId}
      campaignName={page.campaign.name}
      campaignSlug={page.campaign.slug}
      pageTitle={page.title}
      pages={allPages}
      initialData={initialData}
      canEdit={canEdit}
      theme={(page.campaign.theme as CampaignTheme | null) ?? null}
      orgBranding={(org?.branding as CampaignTheme | null) ?? null}
      audienceFields={audienceFields}
    />
  );
}
