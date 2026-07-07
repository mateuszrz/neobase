import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Matches the old vercel.json behaviour so existing indexed URLs keep working.
  trailingSlash: true,
};

export default nextConfig;
