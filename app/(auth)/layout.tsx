import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
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
      <main className="flex flex-1 items-center justify-center px-6 pb-20 pt-8 sm:pb-28">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
