import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stop `next dev` from rewriting AGENTS.md.
  agentRules: false,
  serverExternalPackages: ["googleapis", "mammoth", "unpdf"],
};

export default nextConfig;
