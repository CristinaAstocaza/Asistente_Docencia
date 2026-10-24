import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.API_URL || "http://127.0.0.1:4000"}/api/:path*` }];
  },
  // Allow a 50 MB file plus multipart headers through the API rewrite.
  // AI generation can outlast the default 30-second upstream socket deadline.
  // Leave room for source retrieval, provider retries and optional visual generation.
  experimental: { proxyClientMaxBodySize: "55mb", proxyTimeout: 600_000 },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
