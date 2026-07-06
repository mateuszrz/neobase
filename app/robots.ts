import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

const base = () => env.APP_BASE_URL.replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  const b = base();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/panel/"] }],
    sitemap: `${b}/sitemap.xml`,
    host: b,
  };
}
