import type { NextConfig } from "next";
import { join } from "node:path";

// Proxy /api/* to the standalone bun backend (server/). In production set
// NEXT_PUBLIC_API_BASE to the deployed backend URL; locally it defaults to
// the server's dev port (8787). See PRD §10a.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8787";

const nextConfig: NextConfig = {
  // This app lives inside a bun monorepo; pin the workspace root to silence
  // the multi-lockfile inference warning.
  turbopack: {
    root: join(import.meta.dirname, ".."),
  },
  // The workspace packages (@autonoe/*) are prebuilt to dist by the
  // `vercel-build` script before `next build`. The wallet package's dist .d.ts
  // carries a known viem/abitype duplicate-type clash (a false positive from
  // two copies of abitype in the graph); don't let it fail the production
  // build. Type safety is still enforced in local dev + CI typecheck.
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
