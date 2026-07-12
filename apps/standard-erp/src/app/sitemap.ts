import type { MetadataRoute } from "next";

const BASE = "https://madstoq.com";

/** Public marketing pages only — app portals are noindex and omitted. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  const entries: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/about.html", priority: 0.8, changeFrequency: "monthly" },
    { path: "/services.html", priority: 0.9, changeFrequency: "monthly" },
    { path: "/ahmedabad-it-saas.html", priority: 0.95, changeFrequency: "weekly" },
    { path: "/inventory.html", priority: 0.9, changeFrequency: "monthly" },
    { path: "/io.html", priority: 0.9, changeFrequency: "monthly" },
    { path: "/pmc.html", priority: 0.8, changeFrequency: "monthly" },
    { path: "/portfolio.html", priority: 0.8, changeFrequency: "monthly" },
    { path: "/contact.html", priority: 0.7, changeFrequency: "monthly" },
    { path: "/demo.html", priority: 0.7, changeFrequency: "monthly" },
  ];

  return entries.map(({ path, priority, changeFrequency }) => ({
    url: path === "/" ? `${BASE}/` : `${BASE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
