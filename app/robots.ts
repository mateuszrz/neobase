import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

const base = () => env.APP_BASE_URL.replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  const b = base();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The panel and login now sit under [locale], so a bare "/panel/" rule
        // would stop matching once a non-default locale is prefixed.
        disallow: ["/api/", "/panel/", "/*/panel/", "/login/", "/*/login/"],
      },
    ],
    sitemap: `${b}/sitemap.xml`,
    host: b,
  };
}
