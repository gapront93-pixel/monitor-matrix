import path from "node:path";

import { defineConfig } from "vitest/config";

// Unit tests for pure logic only: no test touches a database
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
