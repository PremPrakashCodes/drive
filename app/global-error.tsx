"use client";

// The last boundary: this one replaces the root layout, so it gets no global
// stylesheet, no fonts and no theme — Tailwind classes here would render
// unstyled. Everything it needs is inline and self-contained, and it follows
// the operating system's colour scheme rather than the app's.
//
// It only ever shows for a failure in the root layout itself; every route
// below has its own boundary that keeps the person inside the application.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "light-dark(#ffffff, #0b0b0c)",
          color: "light-dark(#18181b, #fafafa)",
          colorScheme: "light dark",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <title>Something went wrong - Drive</title>
        <main style={{ maxWidth: "24rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
            Drive couldn&apos;t start
          </h1>
          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "light-dark(#52525b, #a1a1aa)",
            }}
          >
            Your files are safe. This is a problem loading the application, not with anything you
            stored.
          </p>
          <button
            onClick={() => retry()}
            style={{
              marginTop: "1.5rem",
              cursor: "pointer",
              borderRadius: "0.5rem",
              border: "1px solid light-dark(#e4e4e7, #27272a)",
              background: "light-dark(#18181b, #fafafa)",
              color: "light-dark(#fafafa, #18181b)",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p
              style={{
                margin: "1rem 0 0",
                fontSize: "0.75rem",
                color: "light-dark(#71717a, #71717a)",
              }}
            >
              Reference {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
