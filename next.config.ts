import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // scripts/deploy.sh builds into .next-build, then swaps it in, so a failed build never touches the running app
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
