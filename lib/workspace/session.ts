import type { ActionResult } from "@/types";

import { safeRedirect } from "@/lib/auth-form";

// A session that has run out is not a failure the person can act on: every
// later action returns the same thing, so a toast just repeats. The server
// guard tags it (`requireSession` throws `DriveError(..., "session-expired")`),
// which is what we read here — not the sentence it shows, which is wording
// and may be translated or reworded at any time.
export function isSessionExpired(result: ActionResult<unknown>): boolean {
  return !result.ok && result.code === "session-expired";
}

// Where to send someone whose session ended, so signing in brings them back to
// the page they were on. Same `next=` convention the proxy and the protected
// layout already use, and `safeRedirect` keeps the round trip on this site and
// out of the auth routes themselves (which would loop).
export function signInPath(location: { pathname: string; search?: string }): string {
  const next = safeRedirect(`${location.pathname}${location.search ?? ""}`);
  return `/sign-in?${new URLSearchParams({ next })}`;
}
