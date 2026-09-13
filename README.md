This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Workspace UI

The file workspace is available at `/drive` after sign-in. Open `/demo` for an
isolated, public UI demo that does not read account or organization data from the
server. The existing server-side authentication gate remains in place for the
protected routes.

### Included

- Responsive sidebar and organization/team switching; mobile navigation drawer
- File grid and table, URL-backed search/filter/sort/view, selection, folder
  navigation, rename, recursive copy/move/trash, restore and permanent deletion
- Local file and folder uploads with progress, pause, cancel, retry; original
  file content stored in IndexedDB and metadata/preferences in localStorage
- Image, PDF, video, audio, text/code and CSV previews; sharing configuration UI
- Organization overview, teams, team members, invitations, roles and statuses
- Storage charts and provider setup flows for S3, R2, GCS and Azure
- Personal and organization settings, appearance, keyboard shortcuts,
  developer configuration, webhooks and sample audit events
- shadcn/Base UI primitives, Nuqs query state, Lucide icons and Sonner feedback

### Demo boundary

This is a functional **frontend demo**, not a cloud storage backend. Mock files
and analytics are illustrative. Upload progress demonstrates local persistence,
not network transfer. Cloud credentials are not retained or tested. Invitations,
sharing links, permissions, API keys, OAuth apps, webhooks and audit logging do
not create real external side effects. Sample documents can download as text;
uploaded files download their original bytes. Unsupported formats show a fallback.
Local state is scoped by signed-in email (or the separate demo identity), and is
not synchronized across devices. Server authorization, object storage transfers,
versioning and collaboration services must be integrated before production use.

### Verification

```sh
npm run lint
npx next typegen
npx tsc --noEmit
node --test tests/file-tree.test.mjs
npm run build
```

The file-tree tests cover recursive selection, cycle prevention, and copying
nested folders without losing parent relationships. Run them with Node 22.18+
(or a later version with native TypeScript type stripping).
