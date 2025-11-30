import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "localhost:5000",
    "127.0.0.1",
    "127.0.0.1:5000",
    "0.0.0.0:5000",
    "*.replit.dev",
    "*.replit.app",
    "*.repl.co",
    "*.pike.replit.dev",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
