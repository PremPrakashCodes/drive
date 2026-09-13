"use client";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Suspense, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
export default function DemoLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <WorkspaceShell
        user={{ name: "Prem Prakash", email: "demo@drive.local" }}
        defaultOpen
        signOutAction={async () => {
          router.push("/sign-in");
        }}
      >
        {children}
      </WorkspaceShell>
    </Suspense>
  );
}
