import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { lastLoginMethod, multiSession, organization } from "better-auth/plugins";

import { db } from "@/db";
import { env } from "@/env";
import { emailSchema, nameSchema } from "@/lib/auth-form";
import {
  invitationEmailHtml,
  passwordResetEmailHtml,
  sendEmail,
  verificationEmailHtml,
} from "@/lib/email";

// The handler is mounted publicly at /api/auth, so it is a second way in
// alongside the server actions. Anything the actions check has to be checked
// here too, or the check is only a suggestion.
function checkLengths(user: { name?: unknown; email?: unknown }) {
  for (const [field, schema] of [
    ["name", nameSchema],
    ["email", emailSchema],
  ] as const) {
    const value = user[field];
    if (value === undefined) continue;
    const result = schema.safeParse(value);
    if (!result.success)
      throw new APIError("BAD_REQUEST", {
        message: result.error.issues[0]?.message ?? `That ${field} isn't valid.`,
      });
  }
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          checkLengths(user);
        },
      },
      update: {
        before: async (user) => {
          checkLengths(user);
        },
      },
    },
  },
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
      async sendInvitationEmail({ id, email, organization, inviter }) {
        const url = `${new URL(env.BETTER_AUTH_URL).origin}/invite/${id}`;
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
  // The default counters live in the memory of one instance. Deployed
  // serverlessly that is a bucket per instance, reset by every cold start, so
  // a limit of five is really five per instance per lifetime. The rows go in
  // the database instead — the Drizzle adapter's `incrementOne` is a single
  // atomic UPDATE, so no transaction support is needed (neon-http has none).
  rateLimit: {
    // Left at the default (`enabled` follows NODE_ENV) so local development
    // isn't throttled; every rule below applies in production.
    storage: "database",
    modelName: "rateLimit",
    customRules: {
      // Better Auth's built-in rule is 3 in 10s, which is 18 password guesses
      // a minute. A minute-long window costs a person who mistypes nothing and
      // cuts a guessing run by most of an order of magnitude.
      "/sign-in/email": { window: 60, max: 5 },
      // Signing up is a once-ever act, and each one sends mail to an address
      // the sender chose. Five an hour leaves a household room to spare.
      "/sign-up/email": { window: 3600, max: 5 },
      // Each request puts a link in someone else's inbox, so the limit is
      // about not being a mail cannon rather than about guessing.
      "/request-password-reset": { window: 3600, max: 3 },
      // No built-in rule covers the endpoint that spends the token — only the
      // one that asks for it — so without this it sat at the global 100/min.
      "/reset-password": { window: 3600, max: 10 },
      "/send-verification-email": { window: 3600, max: 5 },
      // The actions throttle invitations per sender (lib/drive/invite-limit.ts);
      // this bounds the same endpoint reached over HTTP directly.
      "/organization/invite-member": { window: 3600, max: 30 },
    },
  },
  advanced: {
    // With nothing configured Better Auth reads `x-forwarded-for`, and a
    // forwarded chain with more than one hop resolves to no address at all —
    // which collapses every client into one shared bucket per path. Vercel
    // sets the first two headers itself and overwrites whatever a client sent,
    // so they are the trustworthy ones; `x-forwarded-for` stays last for other
    // hosts, where it is only honoured when it holds a single address.
    ipAddress: {
      ipAddressHeaders: ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"],
    },
    database: {
      generateId: "uuid",
      joins: true,
    },
  },
});
