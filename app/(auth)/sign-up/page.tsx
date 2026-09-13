import type { Metadata } from "next";
import { AuthPage, type AuthSearchParams } from "@/components/auth/auth-page";

export const metadata: Metadata = { title: "Create an account" };

export default function Page({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  return <AuthPage mode="sign-up" searchParams={searchParams} />;
}
