"use server";

import { APIError } from "better-auth/api";
import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { auth } from "@/lib/auth";
import { authSchemas, safeRedirect } from "@/lib/auth-form";
import type { AuthMode, AuthState } from "@/types";

// Go through the handler so Better Auth's request hooks and rate limits also
// apply to Server Actions. Forward cookies explicitly at the Next.js boundary.
async function authRequest(path: string, body: Record<string, unknown>, requestHeaders: Headers) {
  const context = await auth.$context;
  const forwarded = new Headers(requestHeaders);
  forwarded.set("content-type", "application/json");
  forwarded.delete("content-length");
  const response = await auth.handler(
    new Request(`${context.baseURL}${path}`, {
      method: "POST",
      headers: forwarded,
      body: JSON.stringify(body),
    })
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new APIError(
      response.status === 429
        ? "TOO_MANY_REQUESTS"
        : response.status >= 500
          ? "INTERNAL_SERVER_ERROR"
          : "BAD_REQUEST",
      { code: error.code, message: "Authentication request failed." }
    );
  }
  const cookieStore = await cookies();
  for (const [name, attributes] of parseSetCookieHeader(response.headers.get("set-cookie") ?? "")) {
    cookieStore.set(name, attributes.value, toCookieOptions(attributes));
  }
  return response.json();
}

// Values used to re-fill the form after a failed submit.
function preservedValues(raw: Record<string, unknown>): AuthState["values"] {
  return {
    email: typeof raw.email === "string" ? raw.email.slice(0, 254) : "",
    name: typeof raw.name === "string" ? raw.name.slice(0, 100) : "",
  };
}

export async function submitAuth(
  mode: AuthMode,
  _previous: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!Object.hasOwn(authSchemas, mode)) return { error: "Invalid request." };
  const raw = Object.fromEntries(formData);
  const values = preservedValues(raw);
  const invalid = (error: z.ZodError): AuthState => ({
    values,
    fieldErrors: error.flatten().fieldErrors,
    error: "Please check the highlighted fields.",
  });
  // Use the same validated destination after login and email verification.
  const next = safeRedirect(formData.get("next"));
  // Where the link in the verification email lands. It has to be the landing
  // page and not `next`: when the token has expired or was already spent,
  // Better Auth appends `?error=<code>` to this URL, and that page is the only
  // place those codes are turned into something a person can act on. `next`
  // rides along so a successful verification still continues where they were
  // headed. `safeRedirect` refuses /verify-email, which is what kept the
  // landing page unreachable.
  const callbackURL = `/verify-email?next=${encodeURIComponent(next)}`;

  try {
    const requestHeaders = await headers();
    switch (mode) {
      case "sign-in": {
        const parsed = authSchemas["sign-in"].safeParse(raw);
        if (!parsed.success) return invalid(parsed.error);
        await authRequest("/sign-in/email", { ...parsed.data, callbackURL }, requestHeaders);
        break;
      }
      case "sign-up": {
        const parsed = authSchemas["sign-up"].safeParse(raw);
        if (!parsed.success) return invalid(parsed.error);
        const { token } = await authRequest(
          "/sign-up/email",
          { ...parsed.data, callbackURL },
          requestHeaders
        );
        // No token means no session yet — the verification email is on its way.
        if (!token) return { success: true, values: { email: parsed.data.email } };
        break;
      }
      case "forgot-password": {
        const parsed = authSchemas["forgot-password"].safeParse(raw);
        if (!parsed.success) return invalid(parsed.error);
        await authRequest(
          "/request-password-reset",
          { email: parsed.data.email, redirectTo: "/reset-password" },
          requestHeaders
        );
        return { success: true, values: { email: parsed.data.email } };
      }
      case "reset-password": {
        const parsed = authSchemas["reset-password"].safeParse(raw);
        if (!parsed.success) return invalid(parsed.error);
        await authRequest(
          "/reset-password",
          { newPassword: parsed.data.password, token: parsed.data.token },
          requestHeaders
        );
        break;
      }
    }
  } catch (error) {
    if (error instanceof APIError) {
      if (error.status === "INTERNAL_SERVER_ERROR")
        return {
          values,
          error: "The service is temporarily unavailable. Please try again in a moment.",
        };
      if (error.body?.code === "EMAIL_NOT_VERIFIED")
        return {
          values,
          error:
            "Verify your email before signing in. Check your inbox for a verification link, then try again.",
        };
      if (error.status === "TOO_MANY_REQUESTS")
        return {
          values,
          error: "Too many attempts. Please wait a little and try again.",
        };
      if (mode === "sign-in")
        return {
          values,
          error: "Unable to sign in. Check your email and password and try again.",
        };
      if (mode === "reset-password")
        return {
          error: "This reset link is invalid or has expired. Request a new link below.",
        };
      if (mode === "sign-up")
        return {
          values,
          error: "Unable to create an account. Try signing in if you already have one.",
        };
    }
    return {
      values,
      error: "Something went wrong. Please try again in a moment.",
    };
  }
  redirect(mode === "reset-password" ? "/sign-in?reset=success" : next);
}
