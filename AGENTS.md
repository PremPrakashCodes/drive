<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:repo-map -->

# Repository map

Where things live — check here before creating new files:

- **Routes**: `app/(auth)/` (sign-in/up, forgot/reset password, verify-email), `app/(protected)/` (the drive UI; `[section]/` = personal sections like settings/storage, `org/[organization]/` = shared drives), `app/invite/[id]`, `app/api/auth/[...all]/` (Better Auth handler).
- **Server actions**: `app/(auth)/actions.ts`, `app/(protected)/actions.ts`, and `lib/drive/*.ts` (`"use server"` modules). Server-side modules use `import "server-only"` — never import them from client components.
- **`ActionResult<T>`** (`types/drive.ts`): `{ ok: true, data: T } | { ok: false, error: string }` — server actions return errors as values, they don't throw across the boundary. Parse/validate inputs with `lib/drive/action.ts`'s `parse`.
- **`lib/drive/`** = server-side domain (db queries, S3, orgs, items, workspace guard via `requireWorkspace`). **`lib/workspace/`** = client-safe helpers (types, `file-tree`, `detect`, `data`). Don't put server imports in `lib/workspace/`.
- **Server-data boundary**: drive listings/orgs/teams live in `components/workspace/store.tsx` (`WorkspaceProvider`), NOT in Redux. Redux (`store/`) is client UI state only.
- **Types**: named TypeScript types live in `types/<domain>.ts` (`auth`, `date`, `drive`, `files`, `organization`, `settings`, `store`, `workspace`), re-exported by `types/index.ts` — import them from `@/types`, don't declare them inline or in `lib/`.
- **Database**: one table per file in `db/schema/` re-exported via the `db/schema/index.ts` barrel (use `snakeCase.table` for snake_case columns); relations in `db/relations.ts` (`defineRelations`); migrations in `drizzle/`.
- **Env**: `env.ts` zod-validates `process.env` (server-only); secrets go in `.env.local`.

<!-- END:repo-map -->

<!-- BEGIN:commands -->

# Commands

- Dev: `npm run dev` · Prod build: `npm run build` · Start: `npm run start`
- Type-check: `npx tsc --noEmit` · Lint: `npm run lint` · Format: `npm run format`
- DB (need `DATABASE_URL` in `.env.local`; drizzle-kit loads it via `@next/env`): `npm run db:generate` (create migration in `drizzle/`), `npm run db:migrate` (apply), `npm run db:push` (sync, no migration files), `npm run db:studio`

<!-- END:commands -->

<!-- BEGIN:better-auth-docs -->

# Better Auth reference

This project uses Better Auth 1.7.4 (see `lib/auth.ts`, `db/schema/`). Before writing or modifying auth code:

1. To re-check the installed version: `node -p "JSON.parse(require('fs').readFileSync('node_modules/better-auth/package.json','utf8')).version"` (direct `require('better-auth/package.json')` fails — subpath not exported).
2. Find the relevant page in the docs index at `https://better-auth.com/docs/llms.txt` (1.7.x line; older lines: `https://better-auth.com/docs/<version>/llms.txt`, e.g. `1.6`).
3. Fetch the page's `.md` URL for clean Markdown; cite the canonical URL without the `.md` suffix.

Key local entry points: `lib/auth.ts` (server instance), `app/api/auth/[...all]/route.ts` (handler), `db/schema/*` (Better Auth tables incl. organization/session/storage plugins).

<!-- END:better-auth-docs -->

<!-- BEGIN:shadcn-docs -->

# shadcn/ui reference

This project uses shadcn/ui (see `components.json`, `components/ui/`). Before writing or modifying UI components:

1. Docs index for LLMs: `https://ui.shadcn.com/llms.txt` — find the relevant page there, then fetch its `.md` URL for clean Markdown.
2. Components live in `components/ui/` — generated in the **`base-nova`** style (see `components.json`), so they wrap **Base UI** primitives, not Radix (see the Base UI block below). Add new ones with `npx shadcn@latest add <component>` rather than hand-writing.

<!-- END:shadcn-docs -->

<!-- BEGIN:forms-docs -->

# Forms (react-hook-form + shadcn/ui) reference

This project builds forms with react-hook-form ^7.88.0 + zod ^4.6.2 (via `@hookform/resolvers`' `zodResolver`), rendered with shadcn/ui components. Before writing or modifying form code:

1. Docs: shadcn forms guides — `https://ui.shadcn.com/docs/forms` and `https://ui.shadcn.com/docs/forms/react-hook-form` (fetch the `.md` URLs for clean Markdown). react-hook-form has NO `llms.txt` — use `https://react-hook-form.com/docs` and API pages like `https://react-hook-form.com/docs/useform` directly.
2. Use the shadcn `Field` family from `components/ui/field.tsx` (`Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, `FieldError`) with RHF's `register` / `Controller` — do NOT add the legacy `components/ui/form.tsx` Form wrapper.
3. Shared zod form schemas live in `lib/auth-form.ts` (`authSchemas`) — keep validation schemas in `lib/` and reuse them client-side (`zodResolver`) and server-side (`safeParse`) instead of duplicating rules.

Conventions:

- `useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })` + `handleSubmit` for new client forms; prefer this over `useActionState` with hand-rolled `fieldErrors`.
- The server action remains the authority — client validation is UX; re-validate with the shared schema server-side.
- Surface field errors via `FieldError`, submit state via `formState.isSubmitting`, matching the existing auth form styling.

<!-- END:forms-docs -->

<!-- BEGIN:nuqs-docs -->

# nuqs (URL query state) reference

This project uses nuqs ^2.10.1 for all URL/search-param state (see `app/layout.tsx`, `components/`). Before writing or modifying query-state code:

1. Docs for LLMs: `https://nuqs.dev/llms.txt` — the domain moved from nuqs.47v.com (old links 404). Find the relevant page there, then fetch its `.md` URL for clean Markdown; the complete docs in one file live at `https://nuqs.dev/llms-full.txt`.
2. The `NuqsAdapter` from `nuqs/adapters/next/app` is mounted once in `app/layout.tsx` wrapping `{children}` — do not add adapters elsewhere.

Conventions:

- Use `useQueryState` / `useQueryStates` from `nuqs` — never read/write `window.location.search` or `useSearchParams` for state that belongs in the URL.
- Always pass a parser (`parseAsString`, `parseAsInteger`, `parseAsStringLiteral`, …) so types are inferred; use `{ defaultValue: … }` to keep params out of the URL when unset.
- Navigation-style state (current folder, previewed file id, settings section) uses `{ history: "push" }` so back/forward works; filters (search, tab, status) default to `replace`. When one hook owns both roles (the file browser does), put `history` on the **parser** (`parseAsString.withOptions({ history: "push" })`, see `components/files/browser/constants.ts`) rather than on the hook: nuqs reads `parser.history` first and merges a mixed update into one URL write, pushed only if a navigation parameter is in it. `components/files/browser/constants.test.ts` holds that role table.
- Shared param names across components: `folder`, `search`, `view` (previewed file id), `layout` (grid/list), `tab`, `section`, `status`, `action`, `invite`, `command` (⌘K palette query — deliberately not `search`, which belongs to the file browser) — reuse these keys instead of inventing near-duplicates.

<!-- END:nuqs-docs -->

<!-- BEGIN:redux-docs -->

# Redux Toolkit reference

This project uses Redux Toolkit + react-redux for **client/UI state only** (see `store/`). Before writing or modifying Redux code:

1. No `llms.txt` exists for Redux — do not look for one. Docs are Markdown-source on GitHub; fetch the raw file for clean Markdown, e.g. `https://raw.githubusercontent.com/reduxjs/redux-toolkit/master/docs/tutorials/typescript.md` (TS quick start). Other pages mirror the site paths: `docs/api/<api>.md`, `docs/usage/usage-with-typescript.md`. react-redux docs: `https://github.com/reduxjs/react-redux/tree/master/docs` (raw files under `master/docs/`).
2. Structure: `store/store.ts` (`makeStore`, `RootState`, `AppDispatch`), `store/hooks.ts` (typed hooks), `store/StoreProvider.tsx` (client component, per-request store via `useRef` — never a module-level store), `store/slices/` (one file per domain).
3. `store/hooks.ts` MUST keep its `"use client"` directive: react-redux's `react-server` export condition (`dist/rsc.mjs`) replaces `useDispatch`/`useSelector`/`useStore` with throw-stubs that lack `.withTypes`, so evaluating hooks.ts from a server component (e.g. via the `@/store` barrel in the root layout) crashes at runtime with `withTypes is not a function`.

Conventions:

- Always use `useAppDispatch` / `useAppSelector` / `useAppStore` from `store/hooks.ts` — never the bare react-redux hooks. Import via `@/store` (barrel re-exports `StoreProvider`, hooks, and types).
- New feature state → new slice file in `store/slices/`, then register its reducer in `store/store.ts`'s `combineReducers`.
- Server data (drive listings, orgs, teams, uploads) does NOT belong in Redux — it stays in server components/actions and `components/workspace/store.tsx`'s `WorkspaceProvider`. Only cross-cutting client UI state goes in slices.
- Slice pattern: named reducers as `<thing>Changed` (e.g. `sidebarCollapsedChanged`) with `PayloadAction` typing, plus `selectors` on the slice for colocated selectors.

<!-- END:redux-docs -->

<!-- BEGIN:date-fns-docs -->

# date-fns reference

This project uses `date-fns` (v4.4.0) for all date/time formatting, parsing, and comparison (see `lib/date.ts`). Before writing or modifying date code:

1. No `llms.txt` exists for date-fns — do not look for one (`https://date-fns.org/llms.txt` is 404). Per-function reference: `https://date-fns.org/v4.4.0/docs/<Function>` (e.g. `/docs/format`, `/docs/subDays` — PascalCase names). Long-form guides as clean Markdown from GitHub raw, pinned to the installed version tag: `https://raw.githubusercontent.com/date-fns/date-fns/v4.4.0/pkgs/core/docs/<guide>.md` (`gettingStarted`, `timeZones`, `i18n`, `unicodeTokens`, `fp`, `cdn`, `webpack`) — raw paths on `main` 404 (repo restructured into `pkgs/core/`).
2. date-fns v4 is pure ESM with named exports (`format`, `subDays`, `parseISO`, …) and full TypeScript types — import directly from `"date-fns"`, no config needed.
3. Reusable helpers live in `lib/date.ts` (`formatShortDate`, `formatMediumDate`, `formatLongDate`, `formatDateTime`, `formatFullTimestamp`, `formatRelativeTime`, `formatInAbout`, `parseDate`, `toDate`, `compareByDate`, `isDateBefore`/`isDateAfter`/`isDateOnOrAfter`, `isDatePast`/`isDateFuture`).

Conventions:

- Never hand-roll `new Date(x).toLocaleDateString(...)` / `Intl.DateTimeFormat` in components — use the `lib/date.ts` helpers so every surface stays consistent; add a new helper there if a format is needed in 2+ places.
- Helpers accept `DateInput` (`Date | string | number | null | undefined`) and return `"—"` (formatting) or `undefined` (parsing) for missing/invalid input — never an Invalid Date or NaN.
- One-off raw date-fns calls (e.g. `subDays(new Date(), 7)` in a filter memo) are fine; day-precision formats use tokens `"MMM d"` (short), `"MMM d, yyyy"` (medium), `"MMMM d, yyyy"` (long) to match the previous en-US output.
- Timestamps cross the client/server boundary as ISO strings — parse via `parseDate` (or pass the string straight to the format helpers) rather than `new Date(string)`.

<!-- END:date-fns-docs -->

<!-- BEGIN:drizzle-docs -->

# Drizzle ORM reference

This project uses drizzle-orm + drizzle-kit **1.0.0-rc.4** (see `db/`, `drizzle.config.ts`). Before writing or modifying schema/query code:

1. Docs index for LLMs: `https://orm.drizzle.team/llms.txt`. This is a **1.0 RC** — APIs may differ from training data (e.g. relations are defined with the `defineRelations` v1 API in `db/relations.ts`, passed to `drizzle({ client, relations })` in `db/index.ts`, not the old `relationalQueries` mode).
2. `db/index.ts` uses the **Neon serverless HTTP driver** (`drizzle-orm/neon-http` + `@neondatabase/serverless`) — no local Postgres driver; queries run over HTTP, so keep transaction usage to what neon-http supports (`db.transaction` is not available on this driver).
3. Relation keys follow Better Auth's generator with `usePlural: true` (plural table names as keys) — this lets the Better Auth Drizzle adapter use joins. Regenerate parity with `npx auth generate` before changing Better Auth tables.
4. Gotcha: the Better Auth CLI (jiti) fails on `@/` alias imports inside the `db/schema/index.ts` barrel (`MODULE_NOT_FOUND` even though top-level `@/db` resolves). If `npx auth generate` errors, temporarily switch the barrel's intra-schema exports to relative `./` imports.

Conventions:

- One `pgTable` per file in `db/schema/`, re-exported from the barrel (drizzle-kit reads the barrel via `drizzle.config.ts`'s `schema: "./db/schema/index.ts"`). Use `snakeCase.table` for snake_case DB columns; enums in `db/schema/enums.ts`.
- Migration workflow: edit schema → `npm run db:generate` → review the generated SQL in `drizzle/` → `npm run db:migrate`. Never edit applied migration files.
- Timestamps are `timestamp({ withTimezone: true })` columns; they serialize to ISO strings at the action boundary — keep handing ISO strings to the `lib/date.ts` helpers on the client.

<!-- END:drizzle-docs -->

<!-- BEGIN:zod-docs -->

# zod reference

This project uses **zod 4** (^4.6.2). Before writing or modifying validation code:

1. Docs index for LLMs: `https://zod.dev/llms.txt` (covers Zod 4 specifically). String formats moved to **top-level APIs** in v4: prefer `z.email()`, `z.url()`, `z.uuid()`, `z.base64()` over the deprecated `z.string().email()` chains (legacy chains still compile — `env.ts` uses `z.url({ protocol, error })`, while `lib/auth-form.ts` still has `z.string().trim().email()`; use top-level forms in new code).
2. v4 error customization uses the `error` param (string or `(issue) => string`), as in `env.ts` — not the v3 `message`/`invalid_type_error` pair.

Conventions:

- Shared schemas live in `lib/`: `env.ts` (server env), `lib/auth-form.ts` (`authSchemas`, used by both `zodResolver` on the client and `safeParse` on the server). Reuse them instead of duplicating validation rules.
- Server actions re-validate with the same schema — client validation is UX only.
- For server actions, validate through `parse` from `lib/drive/action.ts`, which converts `ZodError` into the `ActionResult` error shape.

<!-- END:zod-docs -->

<!-- BEGIN:base-ui-docs -->

# Base UI reference

The primitives in `components/ui/` wrap **`@base-ui/react` 1.8.0** (via the shadcn `base-nova` style) — they are **NOT Radix**. Before writing or modifying UI components:

1. Docs index for LLMs: `https://base-ui.com/llms.txt` — fetch the listed `.md` URLs for clean Markdown (Tailwind examples target Tailwind v4, which this project uses).
2. Composition uses the **`render` prop** (e.g. `<DropdownMenuTrigger render={<Button />}>`), NOT Radix's `asChild` — there is zero `asChild` in this repo. Portals/mount behavior also differ from Radix; when in doubt, check how the existing `components/ui/` wrapper does it.
3. Do NOT consult Radix docs or copy Radix snippets when editing `components/ui/` — the component APIs (`Dialog.Root.Props`, `Menu.Item` etc.) follow Base UI's namespace layout.

Conventions:

- Import UI primitives from `@/components/ui/*` (the shadcn wrappers), not directly from `@base-ui/react`, so styling stays consistent.
- `cn` comes from `@/lib/utils`; keep the existing className-merge pattern when extending wrappers.

<!-- END:base-ui-docs -->
