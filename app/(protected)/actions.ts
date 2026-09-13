"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

// nextCookies() in lib/auth.ts forwards the cleared session cookies set by
// auth.api.signOut to the response.
export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
