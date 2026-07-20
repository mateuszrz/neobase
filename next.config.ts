import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Matches the old vercel.json behaviour so existing indexed URLs keep working.
  // Load-bearing for locale routing too: /pl must normalise to /pl/.
  trailingSlash: true,
};

export default withNextIntl(nextConfig);
