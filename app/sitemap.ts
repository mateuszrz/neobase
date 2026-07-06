import type { MetadataRoute } from "next";
import { listNeobanks, listExchanges } from "@/lib/queries";
import { env } from "@/lib/env";

export const revalidate = 3600;

const base = () => env.APP_BASE_URL.replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const b = base();
  const now = new Date();

  // trailingSlash: true in next.config → canonical URLs end with "/".
  const staticRoutes: MetadataRoute.Sitemap = ["/", "/neobanks/", "/exchanges/", "/about/", "/monitoring/"].map((p) => ({
    url: `${b}${p}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: p === "/" ? 1 : 0.7,
  }));

  try {
    const [neobanks, exchanges] = await Promise.all([listNeobanks(), listExchanges()]);
    const profiles: MetadataRoute.Sitemap = [
      ...neobanks.map((f) => ({ url: `${b}/fintech/${f.id}/`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 })),
      ...exchanges.map((f) => ({ url: `${b}/exchange/${f.id}/`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 })),
    ];
    return [...staticRoutes, ...profiles];
  } catch {
    // DB unreachable — still serve the static routes rather than 500.
    return staticRoutes;
  }
}
