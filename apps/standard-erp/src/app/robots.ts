import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/inventory/",
          "/inward-outward/",
          "/pmc/",
          "/personal/",
        ],
      },
    ],
    sitemap: "https://madstoq.com/sitemap.xml",
    host: "https://madstoq.com",
  };
}
