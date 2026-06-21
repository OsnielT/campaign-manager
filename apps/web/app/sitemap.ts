import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://stemflow.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: APP_URL, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${APP_URL}/signup`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.8 },
    { url: `${APP_URL}/login`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.7 },
    { url: `${APP_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.5 },
    { url: `${APP_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.5 },
    { url: `${APP_URL}/cookies`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.4 },
  ];
}
