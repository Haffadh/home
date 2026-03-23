const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: __dirname
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

module.exports = nextConfig;
