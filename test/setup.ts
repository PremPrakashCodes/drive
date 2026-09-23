// Runs before any test module is imported.
//
// .env.local is read here, not through @next/env: Next deliberately skips that
// file when NODE_ENV is "test", which is exactly what vitest sets, so
// loadEnvConfig returns without TEST_DATABASE_URL. Loading it in the setup file
// rather than in vitest.config.mts also matters — the config is evaluated in
// the main process and each worker gets its own copy of the environment.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (CI, a fresh clone): the database suites skip themselves.
}

//
// Database-backed tests must never touch the development database. They read
// TEST_DATABASE_URL — a disposable Neon branch with `npm run db:migrate`
// applied — and every server module reaches the database through `@/env`,
// which snapshots process.env at import. Overriding DATABASE_URL here, before
// that snapshot is taken, points the whole graph at the test branch.
//
// With TEST_DATABASE_URL unset, DATABASE_URL becomes an unroutable placeholder
// rather than the development database. `describeDb` skips the suites that
// would issue queries; the placeholder only has to let modules import, because
// most pure-logic helpers live in modules that reach `@/db` at import time and
// Neon's HTTP client does not connect until a query runs. A query that escapes
// the gate fails to resolve instead of writing somewhere real.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://test:test@no-test-database.invalid/test";

// `env.ts` requires these regardless of what a test exercises, and it throws at
// import rather than at use — so without them a fresh clone or a CI runner does
// not skip the database suites, it fails most of the suite before a single test
// runs. `??=` so a real .env.local still wins.
process.env.RESEND_API_KEY ??= "test-resend-key";
process.env.BETTER_AUTH_SECRET ??= "test-better-auth-secret-at-least-32-chars";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
