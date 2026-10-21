import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // scripts/deploy.sh builds into .next-build, then swaps it in, so a failed build never touches the running app
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The 2GB VPS cannot hold the build and the type check at once: run `npm run typecheck` first, then build with SKIP_BUILD_TYPECHECK=1
  typescript: { ignoreBuildErrors: process.env.SKIP_BUILD_TYPECHECK === "1" },
  poweredByHeader: false,
  serverExternalPackages: ["exceljs"],
  // URLs used to be Vietnamese: old links and bookmarks move to the English path (query string kept)
  async redirects() {
    const moved: [string, string][] = [
      ["/bang-gia", "/prices"],
      ["/san-pham", "/products"],
      ["/so-sanh", "/compare"],
      ["/doi-thu", "/competitors"],
      ["/doanh-so", "/sales"],
      ["/nhap-khau", "/imports"],
      ["/tai-khoan", "/account"],
      ["/admin/anh", "/admin/images"],
      ["/anh", "/images"],
    ];
    return moved.map(([from, to]) => ({ source: `${from}/:path*`, destination: `${to}/:path*`, permanent: true }));
  },
  // The old login URL still answers 200: the health check of the scripts/deploy.sh already on the VPS asks for /dang-nhap
  async rewrites() {
    return [{ source: "/dang-nhap", destination: "/login" }];
  },
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
