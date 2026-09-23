// Runs before migrations during a deploy's build step.
//
// Two jobs. It refuses to build without DATABASE_URL, because the build would
// otherwise produce an app that cannot answer a single request. And it prints
// which database is about to be migrated, which is the one thing worth seeing
// in a build log: a preview deployment whose DATABASE_URL points at the
// production database will migrate production from a feature branch, and the
// only way to notice is for the host to be written down at the moment it
// happens.

// A deploy has its variables in the environment already; a local build has
// them in .env*, the same place drizzle-kit reads them from a moment later.
// @next/env is CommonJS, so it has no named ESM export to destructure.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;

if (!url) {
  console.error(
    "DATABASE_URL is not set, so migrations cannot run and the app could not " +
      "start if they did. Set it for this environment in the project settings."
  );
  process.exit(1);
}

// Host and database name only — the connection string carries a password.
const target = (() => {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return "an unparseable DATABASE_URL";
  }
})();

console.log(`Applying migrations to ${target} (${process.env.VERCEL_ENV ?? "local"})`);
