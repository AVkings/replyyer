import type { MetadataRoute } from "next";

const SITE = "https://repllyer.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/onboarding`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
