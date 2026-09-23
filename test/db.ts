import { describe } from "vitest";

// Whether a disposable database branch is configured for this run. Set
// TEST_DATABASE_URL in .env.local to a Neon branch with `npm run db:migrate`
// applied; test/setup.ts points DATABASE_URL at it.
export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

// Use for suites that read or write the database. They skip — rather than
// fail — when no test branch is configured, so `npm run test:run` stays a
// usable gate without one.
export const describeDb: typeof describe.skip = hasTestDb ? describe : describe.skip;
