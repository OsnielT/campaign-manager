import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://stemflow.io";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/campaigns", "/templates", "/media", "/org", "/onboarding"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
