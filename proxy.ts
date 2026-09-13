import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const PUBLIC_ROUTES = new Set([
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

export async function proxy(request: NextRequest) {
  if (PUBLIC_ROUTES.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const destination = request.nextUrl.pathname + request.nextUrl.search;
  if (!session) {
    const signInURL = new URL("/sign-in", request.url);
    signInURL.searchParams.set("next", destination);
    return NextResponse.redirect(signInURL);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-auth-return-to", destination);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.png$).*)",
  ],
};
