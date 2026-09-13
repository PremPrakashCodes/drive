import type { Metadata } from "next";
import { AuthPage, type AuthSearchParams } from "@/components/auth/auth-page";

export const metadata: Metadata = { title: "Sign in" };

export default function Page({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  return <AuthPage mode="sign-in" searchParams={searchParams} />;
}
