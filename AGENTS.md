<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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
2. Components live in `components/ui/`; add new ones with `npx shadcn@latest add <component>` rather than hand-writing.

<!-- END:shadcn-docs -->
