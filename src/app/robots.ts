import type { MetadataRoute } from "next";

const SITE = "https://repllyer.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/dashboard", "/api/", "/auth/"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
