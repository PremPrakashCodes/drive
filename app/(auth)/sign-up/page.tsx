import type { Metadata } from "next";

import { AuthPage } from "@/components/auth/auth-page";
import type { AuthSearchParams } from "@/types";

export const metadata: Metadata = { title: "Create an account" };

export default function Page({ searchParams }: { searchParams: AuthSearchParams }) {
  return <AuthPage mode="sign-up" searchParams={searchParams} />;
}
