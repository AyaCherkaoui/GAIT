import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The security check sets this so it can run next to a dev server in the same folder.
  ...(process.env.GAIT_DIST_DIR ? { distDir: process.env.GAIT_DIST_DIR } : {}),
  serverExternalPackages: ["googleapis", "mammoth", "unpdf"],
};

export default nextConfig;
