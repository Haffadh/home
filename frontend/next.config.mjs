import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: __dirname,
  },
  // Rewrite /auth/* to /api/auth/* so the frontend auth calls work
  // (original backend served auth routes at /auth/*, not /api/auth/*)
  async rewrites() {
    return [
      {
        source: "/auth/:path*",
        destination: "/api/auth/:path*",
      },
    ];
  },
};

export default nextConfig;
