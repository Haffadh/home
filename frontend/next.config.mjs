import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: __dirname,
  },
  // Map clean URLs to /api/* routes so curl can hit /auth/login, /daily-tasks, etc.
  async rewrites() {
    return [
      { source: "/auth/:path*", destination: "/api/auth/:path*" },
      { source: "/daily-tasks", destination: "/api/daily-tasks" },
      { source: "/daily-tasks/:path*", destination: "/api/daily-tasks/:path*" },
      { source: "/urgent_tasks", destination: "/api/urgent_tasks" },
      { source: "/urgent_tasks/:path*", destination: "/api/urgent_tasks/:path*" },
      { source: "/users", destination: "/api/users" },
    ];
  },
};

export default nextConfig;
