"use server";

import type { ActionResult, DriveTeam } from "@/types";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { teams } from "@/db/schema";
import { auth } from "@/lib/auth";
import { Id, parse, run } from "@/lib/drive/action";
import { requireManage, requireOrg } from "@/lib/drive/org-access";
import { DriveError } from "@/lib/drive/workspace";
import { TeamName } from "@/lib/workspace/names";

const TeamColor = z.enum(["green", "purple", "amber", "blue"]);

export async function createTeamAction(
  slug: string,
  input: { name: string; description?: string; color?: string }
): Promise<ActionResult<DriveTeam>> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    requireManage(ctx.role);
    const name = parse(TeamName, input.name);
    const description = parse(z.string().trim().max(200).optional(), input.description);
    const color = input.color ? parse(TeamColor, input.color) : undefined;
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.organizationId, ctx.id), eq(teams.name, name)));
    if (existing) throw new DriveError("A team with that name already exists.");
    const team = await auth.api.createTeam({
      body: { name, organizationId: ctx.id },
      headers: await headers(),
    });
    const [row] = await db
      .update(teams)
      .set({ description: description ?? null, color: color ?? null })
      .where(eq(teams.id, team.id))
      .returning({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        color: teams.color,
        memberCount: teams.memberCount,
        createdAt: teams.createdAt,
      });
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      color: row.color,
      memberCount: row.memberCount,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

export async function removeTeamAction(slug: string, teamId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    requireManage(ctx.role);
    await auth.api.removeTeam({
      body: { teamId: parse(Id, teamId), organizationId: ctx.id },
      headers: await headers(),
    });
  });
}
