import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Receipts and logos are uploaded through server actions.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
