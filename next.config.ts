import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Receipts and logos are uploaded through server actions.
    serverActions: {
      bodySizeLimit: "12mb",
      // Phone access goes through Tailscale Serve (https://<mac>.<tailnet>.ts.net), a different
      // origin than 127.0.0.1. Only devices on your own tailnet can reach that address.
      allowedOrigins: ["*.*.ts.net"],
    },
  },
};

export default nextConfig;
