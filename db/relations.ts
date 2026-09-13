import { defineRelations } from "drizzle-orm";

import * as schema from "@/db/schema";

// Relation keys follow Better Auth's generator with `usePlural: true`, which
// lets its Drizzle adapter use joins (`advanced.database.joins`).
export const relations = defineRelations(schema, (r) => ({
  users: {
    sessions: r.many.sessions({
      from: r.users.id,
      to: r.sessions.userId,
    }),
    accounts: r.many.accounts({
      from: r.users.id,
      to: r.accounts.userId,
    }),
  },
  sessions: {
    user: r.one.users({
      from: r.sessions.userId,
      to: r.users.id,
      optional: false,
    }),
    activeOrganization: r.one.organizations({
      from: r.sessions.activeOrganizationId,
      to: r.organizations.id,
    }),
    activeTeam: r.one.teams({
      from: r.sessions.activeTeamId,
      to: r.teams.id,
    }),
  },
  accounts: {
    user: r.one.users({
      from: r.accounts.userId,
      to: r.users.id,
      optional: false,
    }),
  },
  organizations: {
    members: r.many.members({
      from: r.organizations.id,
      to: r.members.organizationId,
    }),
    teams: r.many.teams({
      from: r.organizations.id,
      to: r.teams.organizationId,
    }),
    invitations: r.many.invitations({
      from: r.organizations.id,
      to: r.invitations.organizationId,
    }),
    connections: r.many.storageConnections({
      from: r.organizations.id,
      to: r.storageConnections.organizationId,
    }),
  },
  members: {
    user: r.one.users({
      from: r.members.userId,
      to: r.users.id,
      optional: false,
    }),
    organization: r.one.organizations({
      from: r.members.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
  },
  invitations: {
    inviter: r.one.users({
      from: r.invitations.inviterId,
      to: r.users.id,
      optional: false,
    }),
    organization: r.one.organizations({
      from: r.invitations.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    team: r.one.teams({
      from: r.invitations.teamId,
      to: r.teams.id,
    }),
  },
  teams: {
    organization: r.one.organizations({
      from: r.teams.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    members: r.many.teamMembers({
      from: r.teams.id,
      to: r.teamMembers.teamId,
    }),
    invitations: r.many.invitations({
      from: r.teams.id,
      to: r.invitations.teamId,
    }),
  },
  teamMembers: {
    team: r.one.teams({
      from: r.teamMembers.teamId,
      to: r.teams.id,
      optional: false,
    }),
    user: r.one.users({
      from: r.teamMembers.userId,
      to: r.users.id,
      optional: false,
    }),
  },
  storageProviders: {
    connections: r.many.storageConnections({
      from: r.storageProviders.id,
      to: r.storageConnections.providerId,
    }),
  },
  storageConnections: {
    user: r.one.users({
      from: r.storageConnections.userId,
      to: r.users.id,
      optional: false,
    }),
    organization: r.one.organizations({
      from: r.storageConnections.organizationId,
      to: r.organizations.id,
    }),
    provider: r.one.storageProviders({
      from: r.storageConnections.providerId,
      to: r.storageProviders.id,
      optional: false,
    }),
  },
  driveItems: {
    organization: r.one.organizations({
      from: r.driveItems.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    parent: r.one.driveItems({
      from: r.driveItems.parentId,
      to: r.driveItems.id,
      alias: "drive_item_parent",
    }),
    children: r.many.driveItems({
      from: r.driveItems.id,
      to: r.driveItems.parentId,
      alias: "drive_item_parent",
    }),
    createdBy: r.one.users({
      from: r.driveItems.createdById,
      to: r.users.id,
      optional: false,
    }),
    stars: r.many.driveStars({
      from: r.driveItems.id,
      to: r.driveStars.itemId,
    }),
  },
  driveStars: {
    item: r.one.driveItems({
      from: r.driveStars.itemId,
      to: r.driveItems.id,
      optional: false,
    }),
    user: r.one.users({
      from: r.driveStars.userId,
      to: r.users.id,
      optional: false,
    }),
  },
}));
