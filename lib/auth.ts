import { nextCookies } from "better-auth/next-js";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { lastLoginMethod, multiSession, organization } from "better-auth/plugins";
import { db } from "@/db";
import {
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
      teams: {
        enabled: true,
        // maximumTeams: 10,
        // maximumMembersPerTeam: 50,
        // allowRemovingAllTeams: false, // false = last team cannot be removed
        // defaultTeam: { enabled: true }, // auto-create a default team per org
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
