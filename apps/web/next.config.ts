import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@growth-os/config", "@growth-os/db", "@growth-os/page-engine", "@growth-os/tracking"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" }
    ],
    minimumCacheTTL: 60 * 60 * 24 * 7
  }
};

export default nextConfig;
