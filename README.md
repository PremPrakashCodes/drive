# Drive

A file storage app for families and teams. Files live in your own Amazon S3 or Cloudflare R2
bucket. Drive keeps the folders, sharing, and membership in Postgres.

## Features

- **Files and folders:** upload files or whole folders (with progress, pause, and retry), create
  folders, rename, move, copy, star, and search. Filter by type, owner, or date, and sort. Switch
  between grid and list layouts.
- **Previews:** images, PDFs, video (Video.js), and snippets of text, code, and spreadsheets.
- **Sharing:** every file is either private or shared with everyone in the drive. Shared links
  open the preview (`/drive?view=<file id>`).
- **Trash:** restore or delete permanently. A daily job removes anything left in the trash for
  30 days, and another reclaims bucket objects no row references anymore.
- **Storage:** a storage page with usage by file type and growth by month. Each drive is held to
  a quota (`STORAGE_QUOTA_BYTES`, 100 GB by default), so a member cannot write unbounded data
  into the owner's bucket.
- **Locked folder:** a PIN-protected folder that only you can see. It relocks after a period of
  inactivity.
- **Family drive:** every account gets a personal drive, and the owner can invite family members
  to it.
- **Organizations:** shared drives at `/org/<slug>`, with teams and email invitations. Members
  are owners, admins, or members.
- **Accounts:** email and password sign-in, with required email verification and password reset.
  You can stay signed in to several accounts at once.
- **Quality of life:** <kbd>⌘K</kbd> command palette, <kbd>⌘U</kbd> to upload, dark mode, and
  URL-backed state, so back/forward and shared links work.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, server actions), React 19, TypeScript
- [Better Auth](https://better-auth.com) with the organization plugin
- [Drizzle ORM](https://orm.drizzle.team) 1.0 RC on [Neon](https://neon.tech) serverless Postgres
- S3-compatible object storage through the AWS SDK, with presigned uploads and downloads
- [Resend](https://resend.com) for transactional email
- [shadcn/ui](https://ui.shadcn.com) (Base UI primitives), Tailwind CSS 4
- react-hook-form and zod for forms, [nuqs](https://nuqs.dev) for URL state, Redux Toolkit for UI
  state
- [Recharts](https://recharts.org) for the storage charts, [Vitest](https://vitest.dev) for tests

## Requirements

- Node.js 20.9 or newer
- A Postgres database (the database driver is Neon's serverless driver)
- A [Resend](https://resend.com) API key
- An Amazon S3 or Cloudflare R2 bucket for files. You connect it in the app after signing in.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run db:migrate           # apply the migrations in drizzle/
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and click the link in the
verification email.

### Environment variables

Set these in `.env.local`. `env.ts` validates the server variables when the app starts.

| Variable                 | Required           | Description                                                                                                                                                 |
| ------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | Yes                | Postgres connection string (`postgresql://…`). The migration commands need it too.                                                                          |
| `BETTER_AUTH_SECRET`     | Yes                | Secret that signs sessions. Generate one with `openssl rand -base64 32`.                                                                                    |
| `BETTER_AUTH_URL`        | Yes                | The app's base URL, e.g. `http://localhost:3000`. Used for auth callbacks and invitation links.                                                             |
| `RESEND_API_KEY`         | Yes                | Resend API key for verification, password-reset, and invitation emails.                                                                                     |
| `EMAIL_FROM`             | No                 | Sender address. Defaults to `Drive <onboarding@resend.dev>`, which can only send to your own Resend account's email, so set a verified domain for real use. |
| `STORAGE_ENCRYPTION_KEY` | To connect storage | 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts bucket credentials. Changing it makes saved credentials unreadable.                           |
| `STORAGE_QUOTA_BYTES`    | No                 | Most bytes one drive may hold, across every file in it. Defaults to 100 GB.                                                                                 |
| `CRON_SECRET`            | In production      | At least 16 characters (`openssl rand -hex 32`). Authorizes the daily scheduled jobs. The cron routes reject every request while it's unset.                |

### Connecting storage

The drive owner connects a bucket under **Settings → Storage**, entering the bucket name, the
region (S3) or account endpoint (R2), and an access key pair.

Uploads go straight from the browser to the bucket through presigned URLs, and previews and
downloads use presigned URLs too. So the bucket needs a CORS rule that allows your app's origin:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-app.example.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

S3 and R2 both accept this JSON format in their bucket CORS settings.

### Scheduled jobs

`vercel.json` schedules two daily jobs, both authorized by `CRON_SECRET` as a bearer token:

- `GET /api/cron/empty-trash` (midnight UTC) deletes items that have been in the trash for more
  than 30 days, removing their objects from the bucket first.
- `GET /api/cron/reclaim-orphans` (3 AM UTC) deletes bucket objects no row references anymore.
  Objects get a 24-hour grace period, so an upload still in flight is never swept.

To run a job by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/empty-trash
```

## Scripts

| Command                | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Start the development server                           |
| `npm run build`        | Production build                                       |
| `npm run start`        | Serve the production build                             |
| `npm run lint`         | ESLint                                                 |
| `npm run format`       | Prettier (also sorts imports and Tailwind classes)     |
| `npm run format:check` | Check formatting without writing                       |
| `npm run db:generate`  | Generate a migration in `drizzle/` from schema changes |
| `npm run db:migrate`   | Apply pending migrations                               |
| `npm run db:push`      | Sync the schema directly, without migration files      |
| `npm run db:studio`    | Open Drizzle Studio                                    |
| `npm test`             | Vitest in watch mode                                   |
| `npm run test:run`     | Run the test suite once                                |

Before opening a pull request, run:

```bash
npm run lint && npx tsc --noEmit && npm run format:check && npm run test:run
```

## Project structure

```
app/            Routes: (auth) sign-in and account flows, (protected) the drive UI,
                org/[organization] shared drives, invite/[id], api/auth, api/cron
components/     UI: files/ (browser, previews), settings/, workspace/ (shell, store,
                org pages), upload/, and ui/ (shadcn components)
lib/drive/      Server actions and server-only domain code (items, uploads, orgs,
                members, storage, S3, workspace access checks)
lib/workspace/  Client-safe helpers and shared zod schemas
db/             Drizzle schema (one table per file) and relations
drizzle/        Generated SQL migrations
types/          Shared TypeScript types, imported from `@/types`
store/          Redux Toolkit store for client UI state
test/           Vitest setup (env loading, server-only stub, db test helpers)
```

[`AGENTS.md`](AGENTS.md) describes the conventions in detail: server actions return
`ActionResult`, URL state goes through nuqs, forms use react-hook-form with shared zod schemas,
and it notes version-specific gotchas.

## App Router and state ownership

Follow the [App Router Playground](https://app-router.vercel.app/layouts) pattern: shared UI
belongs in layouts, route entry points remain Server Components, and interactive controls live
in Client Components. A small page that returns `<FileBrowser />` is intentional. Passing
server-rendered `children` through the client workspace shell preserves that server boundary.
The reference implementation is in the playground's
[`app/context/layout.tsx`](https://github.com/vercel/next-app-router-playground/blob/main/app/context/layout.tsx)
and its client `CounterProvider`; Drive uses the same composition with `StoreProvider`.
Route `loading.tsx` and `error.tsx` files handle navigation loading and rendering failures;
the workspace provider separately handles client data refreshes and action errors.

| State                                                     | Owner                                  | Reason                                                                             |
| --------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| Command palette and New folder dialog visibility          | Redux `app` slice                      | Shared controls across the workspace use typed actions rather than browser events. |
| Folder, preview, search, filters, sorting, and pagination | nuqs                                   | URLs support links and browser back/forward.                                       |
| Files, organizations, teams, and invitations              | `WorkspaceProvider` and server actions | Server data needs workspace permissions and refresh handling.                      |
| Selection, form values, validation, and component dialogs | Local React state / react-hook-form    | State belongs to the component that uses it.                                       |
| Sidebar expansion                                         | `SidebarProvider` and its cookie       | Keep one owner for the existing desktop/mobile behavior and persistence.           |
| Upload queue and transfer progress                        | `UploadProvider`                       | Keep browser file handles, cancellation, and transfer lifecycles together.         |

The Redux provider lives in the protected layout, preserving UI state across workspace routes
and creating a fresh store when that layout mounts again. Public account and invitation routes
do not load it. Each provider instance creates its own store; never export a singleton or access
Redux from Server Components. The organization wizard loads on its first open, while Video.js
loads only for video previews. Settings has a server-rendered heading and a client navigation
island; its sections load on demand. Storage charts load separately when the storage page
renders, keeping Recharts out of the file browser's eager imports.

### Data loading and caching

`getWorkspaceSnapshot` makes one Server Action request for a refresh and starts the drive,
organization, and invitation reads together on the server. Each result remains independent:
a failed invitation fetch does not discard a successful drive listing. The client keeps its
generation guards so an older refresh cannot overwrite a newer response, and cancels those
generations when its refresh lifecycle ends.

The drive listing intentionally loads through a Server Action: checking an active Locked folder
renews its HTTP-only unlock cookie. Server Components cannot write that cookie while rendering.
Moving this fetch into a page without separating cookie renewal would change the lock's behavior.

Session, workspace, and lock lookups use request-scoped React `cache` where already supported.
Authenticated listings are not cached across requests: membership, visibility, active workspace,
and lock expiry can change. Successful mutations refresh the client provider; there is no
persistent listing cache to invalidate with `revalidateTag` or `revalidatePath`. Adding such a
cache requires an explicit user/workspace key and invalidation strategy first.

### Incremental architecture audit (Next.js 16.3.5)

| Finding                                                                                                      | Change                                                                                                               |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| The workspace context combined data refresh, route alignment, organization overview, theme, and DTO mapping. | Keep context composition in `store.tsx`; extract navigation, data, overview, theme, and client-safe mapping modules. |
| Every workspace refresh issued three browser Server Action calls.                                            | Aggregate them in `lib/drive/workspace-snapshot.ts`, preserving existing action errors and permissions.              |
| File browser filtering and selection were mixed with mutation dialogs.                                       | Extract `use-file-browser-actions.ts`, retaining one guard across all mutation controls.                             |
| Upload transfer logic and progress markup occupied one large component.                                      | Extract `upload-progress.tsx`; queue, cancellation, retries, and state still belong to `UploadProvider`.             |
| File controls imported the entire workspace shell module.                                                    | Move reusable controls to `components/files/file-actions.tsx`.                                                       |
| Settings and charts eagerly imported heavy interactive modules.                                              | Keep the settings heading on the server and defer sections and chart modules inside client boundaries.               |
| File browser and route loading repeated the same skeleton markup.                                            | Reuse `SectionSkeleton`; retain the existing route loading and error boundaries.                                     |

Routes remain Server Components. Existing route groups and the protected layout preserve the
shell across navigation. nuqs keeps folder/preview/settings navigation in history while filters
replace the current entry. No new route tree or experimental cache mode is needed for these changes.

Workspace switching is coordinated by `use-workspace-navigation.ts`: automatic organization
alignment pauses until both the destination route and its listing have arrived. Refreshing under
the old organization route can otherwise switch the cookie back before navigation finishes.
Back/Forward also aligns personal routes with the previous personal/family drive, so organization
files cannot remain visible under My Drive. `lib/workspace/navigation.test.ts` covers both arrival
orders, personal/family fallback, and organization deep links.

## Deploying

The app targets [Vercel](https://vercel.com):

1. Import the repository and set every environment variable above. `BETTER_AUTH_URL` must be the
   production URL.
2. Migrations run as part of the deploy: the build command in `vercel.json` runs
   `scripts/predeploy.mjs` (which refuses to build without `DATABASE_URL`, and logs which database
   it is about to migrate, so a preview deployment pointing at production is visible), then
   `npm run db:migrate`, then `next build`.
3. Add the production origin to each bucket's CORS rule.
4. The daily scheduled jobs in `vercel.json` run once `CRON_SECRET` is set.
