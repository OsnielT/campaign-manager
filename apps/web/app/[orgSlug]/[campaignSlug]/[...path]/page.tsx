import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { resolveCampaignPage } from "@/lib/campaign-engine/resolve";
import { readSession } from "@/lib/campaign-engine/session";
import { recordConversion } from "@/lib/campaign-engine/conversion";
import { CampaignPageShell } from "@/components/public/CampaignPageShell";
import { resolveBrand } from "@/lib/campaign-engine/theme";
import { ExpiryPage } from "@/components/public/ExpiryPage";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ orgSlug: string; campaignSlug: string; path: string[] }>;
  searchParams: Promise<Record<string, string>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orgSlug, campaignSlug, path } = await params;
  const pagePath = "/" + path.join("/");
  const result = await resolveCampaignPage(orgSlug, campaignSlug, pagePath);
  if (result.action !== "render") return { robots: { index: false } };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://primitive.io";
  const pageUrl = `${appUrl}/${orgSlug}/${campaignSlug}/${path.join("/")}`;
  const title = result.page.metaTitle ?? result.page.title;
  const description = result.page.metaDescription ?? `${result.campaign.name} — ${result.org.name}`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      url: pageUrl,
      title,
      description,
      siteName: result.org.name,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: { canonical: pageUrl },
    robots: { index: false, follow: false },
  };
}

export default async function CampaignSubPage({ params, searchParams }: Props) {
  const { orgSlug, campaignSlug, path } = await params;
  const pagePath = "/" + path.join("/");
  const urlParams = await searchParams;

  const result = await resolveCampaignPage(orgSlug, campaignSlug, pagePath);

  if (result.action === "not_found") notFound();
  // result.url may be an external/arbitrary URL; typedRoutes only types internal paths.
  if (result.action === "redirect") redirect(result.url as Parameters<typeof redirect>[0]);

  const emptyCtx = {
    sessionId: null,
    orgSlug,
    campaignSlug,
    pageTitle: "",
    pagePath: "/",
    formData: {},
    audienceRecord: null,
  };

  if (result.action === "expired") {
    return (
      <ExpiryPage
        campaignName={result.campaign.name}
        expiryPageTree={result.campaign.expiryPageTree}
        ctx={emptyCtx}
      />
    );
  }

  const { org, campaign, page, treeJson } = result;

  // Read-only: no cookie writes in the server component
  const session = await readSession(campaign.id, orgSlug, campaignSlug);

  // Record page_reach conversion for returning visitors with a session
  if (session && page.isConversionPage && !session.convertedAt) {
    const headerStore = await headers();
    const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const ua = headerStore.get("user-agent") ?? null;
    await recordConversion({
      campaignId: campaign.id,
      sessionId: session.id,
      audienceRecordId: session.audienceRecordId ?? null,
      triggerType: "page_reach",
      triggerPageId: page.id,
      triggerElementId: null,
      payload: session.formData as Record<string, unknown>,
      ipAddress: ip,
      userAgent: ua,
    });
  }

  const ctx = {
    sessionId: session?.id ?? null,
    orgSlug,
    campaignSlug,
    pageTitle: page.title,
    pagePath: page.path,
    formData: (session?.formData as Record<string, unknown>) ?? {},
    audienceRecord: session
      ? (session as { audienceRecord?: { id: string; fields: Record<string, unknown>; name: string | null; email: string | null } | null }).audienceRecord ?? null
      : null,
  };

  return (
    <CampaignPageShell
      data={treeJson as Parameters<typeof CampaignPageShell>[0]["data"]}
      ctx={ctx}
      urlParams={urlParams}
      theme={resolveBrand(org.branding, campaign.theme)}
    />
  );
}
