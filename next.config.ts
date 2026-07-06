import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Matches the old vercel.json behaviour so existing indexed URLs keep working.
  trailingSlash: true,
  // Legacy build artifacts must never be compiled by Next.
  outputFileTracingExcludes: {
    "*": ["./_legacy/**/*"],
  },
};

export default nextConfig;
