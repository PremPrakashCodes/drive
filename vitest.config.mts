import { defineConfig } from "vitest/config";

// Environment loading lives in test/setup.ts, not here: @next/env skips
// .env.local whenever NODE_ENV is "test", which is what vitest sets, and a
// worker gets its own copy of the environment anyway.

export default defineConfig({
  test: {
    // Nothing under test renders, so no jsdom.
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // An empty suite is a working runner, not a failure.
    passWithNoTests: true,
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": import.meta.dirname,
      // Most of lib/drive/ imports "server-only", whose default entry throws
      // outside a React Server Component. Next resolves it through the
      // "react-server" export condition to an empty module; this stub does the same.
      "server-only": "./test/server-only-stub.ts",
    },
  },
});
