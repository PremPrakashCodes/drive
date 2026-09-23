import "server-only";

import { Resend } from "resend";

import { env } from "@/env";

const resend = new Resend(env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send a transactional email via Resend. Throws on failure so Better Auth
 * surfaces the error (it awaits this inside its endpoints).
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<void> {
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Failed to send email: no email id returned");
  }
}

function emailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:448px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #e4e4e7;">
                <p style="margin:0;font-size:15px;font-weight:600;color:#18181b;">Drive</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#18181b;">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;">
                <p style="margin:0;font-size:12px;color:#a1a1aa;">If you didn't request this, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const buttonStyle =
  "display:inline-block;padding:10px 20px;background:#18181b;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;";

// Names come from whatever the person typed at sign-up, so every one of them
// is interpolated into markup through this.
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

export function verificationEmailHtml(name: string, url: string): string {
  return emailShell(
    "Verify your email",
    `<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
      Hi ${escapeHtml(name)}, welcome to Drive! Confirm your email address to activate your account.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${url}" style="${buttonStyle}">Verify email</a>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">
      Or paste this link into your browser:<br>
      <a href="${url}" style="color:#18181b;word-break:break-all;">${url}</a>
    </p>`
  );
}

export function passwordResetEmailHtml(name: string, url: string): string {
  return emailShell(
    "Reset your password",
    `<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
      Hi ${escapeHtml(name)}, we received a request to reset your password.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${url}" style="${buttonStyle}">Reset password</a>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">
      Or paste this link into your browser:<br>
      <a href="${url}" style="color:#18181b;word-break:break-all;">${url}</a>
    </p>`
  );
}

export function invitationEmailHtml(
  inviterName: string,
  workspaceName: string,
  url: string
): string {
  return emailShell(
    "You're invited to a shared drive",
    `<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
      ${escapeHtml(inviterName)} invited you to <strong>${escapeHtml(workspaceName)}</strong> on Drive. You'll be able to see shared files, add your own, and keep a private space only you can open.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${url}" style="${buttonStyle}">Accept invitation</a>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">
      Or paste this link into your browser:<br>
      <a href="${url}" style="color:#18181b;word-break:break-all;">${url}</a>
    </p>`
  );
}
