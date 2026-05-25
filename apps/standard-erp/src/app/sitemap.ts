import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://madstoq.com";
  const now = new Date();

  const pages = [
    "",
    "/about.html",
    "/services.html",
    "/inventory.html",
    "/io.html",
    "/pmc.html",
    "/docs/index.html",
    "/docs/inventory-manual.html",
    "/docs/io-manual.html",
    "/docs/pmc-manual.html",
    "/docs/sales-manual.html",
    "/contact.html",
    "/demo.html",
  ];

  return pages.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : 0.8,
  }));
}
