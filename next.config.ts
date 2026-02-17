import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/events/purim-2025",
        destination: "/events/purim-2026",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.thejre.org" }],
        destination: "https://thejre.org/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
