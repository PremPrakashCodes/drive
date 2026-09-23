// Runs before any test module is imported.
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

// `env.ts` requires these regardless of what a test exercises.
process.env.RESEND_API_KEY ??= "test-resend-key";
