import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The 2GB VPS cannot hold the build and the type check at once: run `npm run typecheck` first, then build with SKIP_BUILD_TYPECHECK=1
  typescript: { ignoreBuildErrors: process.env.SKIP_BUILD_TYPECHECK === "1" },
  poweredByHeader: false,
  serverExternalPackages: ["exceljs"],
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
