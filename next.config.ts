import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["googleapis", "mammoth", "unpdf"],
};

export default nextConfig;
