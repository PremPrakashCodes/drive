import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { lastLoginMethod, multiSession, organization } from "better-auth/plugins";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  plugins: [
    multiSession(),
    lastLoginMethod(),
    organization({
      teams: {
        enabled: true,
        // maximumTeams: 10,
        // maximumMembersPerTeam: 50,
        // allowRemovingAllTeams: false, // false = last team cannot be removed
        // defaultTeam: { enabled: true }, // auto-create a default team per org
      },
    }),
  ],
  advanced: {
    database: {
      generateId: "uuid",
      joins: true,
    },
  },
});
