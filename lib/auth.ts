import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { lastLoginMethod, multiSession, organization } from "better-auth/plugins";

import { db } from "@/db";
import {
  invitationEmailHtml,
  passwordResetEmailHtml,
  sendEmail,
  verificationEmailHtml,
} from "@/lib/email";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    // Block sign-in until the user clicks the link in the verification email.
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        html: passwordResetEmailHtml(user.name, url),
        text: `Hi ${user.name},\n\nReset your password with this link:\n${url}\n`,
      });
    },
  },
  emailVerification: {
    // Send on sign up, and re-send when an unverified user tries to sign in.
    sendOnSignUp: true,
    sendOnSignIn: true,
    // Sign the user in automatically after they click the verify link.
    autoSignInAfterVerification: true,
    // 24 hours instead of the 1 hour default.
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        html: verificationEmailHtml(user.name, url),
        text: `Hi ${user.name},\n\nVerify your email by clicking the link below:\n${url}\n\nThe link expires in 24 hours.\n`,
      });
    },
  },
  plugins: [
    multiSession(),
    lastLoginMethod(),
    organization({
      schema: {
        organization: {
          additionalFields: {
            // Set by the app, never by clients: see lib/drive/workspace.ts.
            kind: {
              type: "string",
              input: false,
              required: false,
              defaultValue: "organization",
            },
          },
        },
        team: {
          additionalFields: {
            // Set by the app (lib/drive/org.ts), never by clients.
            description: { type: "string", input: false, required: false },
            color: { type: "string", input: false, required: false },
          },
        },
      },
      async sendInvitationEmail({ id, email, organization, inviter }, request) {
        const origin = new URL(
          process.env.BETTER_AUTH_URL ?? request?.url ?? "http://localhost:3000"
        ).origin;
        const url = `${origin}/invite/${id}`;
        await sendEmail({
          to: email,
          subject: `${inviter.user.name} invited you to ${organization.name}`,
          html: invitationEmailHtml(inviter.user.name, organization.name, url),
          text: `${inviter.user.name} invited you to ${organization.name} on Drive.\n\nAccept the invitation:\n${url}\n`,
        });
      },
      organizationHooks: {
        // Family (personal) workspaces have one owner; everyone else is a
        // member. Members can't invite (plugin default), so only the owner can.
        beforeCreateInvitation: async ({ invitation, organization }) => {
          if (organization.kind === "personal" && invitation.role !== "member")
            throw new APIError("BAD_REQUEST", {
              message: "People join a personal workspace as members.",
            });
        },
        beforeUpdateMemberRole: async ({ organization }) => {
          if (organization.kind === "personal")
            throw new APIError("FORBIDDEN", {
              message: "Roles in a personal workspace can't be changed.",
            });
        },
        beforeDeleteOrganization: async ({ organization }) => {
          if (organization.kind === "personal")
            throw new APIError("FORBIDDEN", {
              message: "Personal workspaces can't be deleted.",
            });
        },
      },
      teams: {
        enabled: true,
        // maximumTeams: 10,
        // maximumMembersPerTeam: 50,
        // allowRemovingAllTeams: false, // false = last team cannot be removed
        defaultTeam: { enabled: false }, // teams are created by the app
      },
    }),
    nextCookies(),
  ],
  advanced: {
    database: {
      generateId: "uuid",
      joins: true,
    },
  },
});
