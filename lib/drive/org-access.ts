import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { members, organizations } from "@/db/schema";
import { DriveError, requireSession } from "@/lib/drive/workspace";

export const Role = z.enum(["owner", "admin", "member"]);
export type Role = z.infer<typeof Role>;

// The organization named by the /org/[organization] route, membership-checked.
export async function requireOrg(slug: string): Promise<{
  id: string;
  name: string;
  slug: string;
  kind: "personal" | "organization";
  role: Role;
  userId: string;
}> {
  const session = await requireSession();
  const [row] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      kind: organizations.kind,
      role: members.role,
    })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(and(eq(members.userId, session.user.id), eq(organizations.slug, slug)));
  if (!row) throw new DriveError("That organization doesn't exist or you're not a member.");
  return {
    id: row.id,
    name: row.name,
    slug,
    kind: row.kind,
    role: Role.parse(row.role),
    userId: session.user.id,
  };
}

export function requireManage(role: Role) {
  if (role === "member")
    throw new DriveError("Only the owner or an admin can manage this organization.");
}

export const roleOf = (role: string | null | undefined) =>
  role === "owner"
    ? ("owner" as const)
    : role === "admin"
      ? ("admin" as const)
      : ("member" as const);
