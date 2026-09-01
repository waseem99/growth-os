import type { NextConfig } from "next";
const nextConfig: NextConfig = { reactStrictMode: true, poweredByHeader: false, transpilePackages: ["@growth-os/config", "@growth-os/db", "@growth-os/page-engine"] };
export default nextConfig;
