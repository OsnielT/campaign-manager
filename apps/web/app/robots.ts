import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://primitive.io";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Disallow admin and API routes
        disallow: ["/api/", "/(admin)/", "/onboarding", "/login", "/signup"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
