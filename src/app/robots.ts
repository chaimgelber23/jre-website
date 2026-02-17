import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/banquest-setup"],
      },
    ],
    sitemap: "https://thejre.org/sitemap.xml",
  };
}
