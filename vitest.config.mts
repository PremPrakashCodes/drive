import nextEnv from "@next/env";
import { defineConfig } from "vitest/config";

// Load .env* the same way `next dev` does, so database-backed tests pick up
// DATABASE_URL from .env.local. Point it at a disposable branch — the tests
// that touch the database write to it. @next/env is CommonJS, so it has no
// named ESM export to destructure at the import.
nextEnv.loadEnvConfig(process.cwd());

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
