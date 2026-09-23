import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

// Rendered wherever `notFound()` is called — today the unknown-section and
// unknown-organization-page routes. It renders inside the root layout, so a
// mistyped URL stays inside the application instead of falling through to the
// framework's bare 404.
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <header className="px-6 py-6 sm:px-10">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Drive<span className="text-muted-foreground">.</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pt-8 pb-20 sm:pb-28">
        <div className="w-full max-w-sm">
          <p className="text-[9px] tracking-[1.5px] text-muted-foreground">404</p>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-tight">
            There&apos;s nothing at this address
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The page you asked for doesn&apos;t exist. If you followed a link to a file, it may have
            been moved or put in the trash.
          </p>
          <Button className="mt-6" nativeButton={false} render={<Link href="/drive" />}>
            Go to my drive
          </Button>
        </div>
      </main>
    </div>
  );
}
