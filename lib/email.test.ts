import { describe, expect, it } from "vitest";

import { invitationEmailHtml, passwordResetEmailHtml, verificationEmailHtml } from "@/lib/email";

// A name is whatever the person typed at sign-up, and it is interpolated into
// markup that lands in someone else's inbox. Every template has to neutralise
// it, not just the one that was written last.
const HOSTILE = `<script>alert("x")</script> & 'co'`;

const templates = [
  ["verification", (name: string) => verificationEmailHtml(name, "https://drive.test/verify")],
  ["password reset", (name: string) => passwordResetEmailHtml(name, "https://drive.test/reset")],
  [
    "invitation",
    (name: string) => invitationEmailHtml(name, "Acme Drive", "https://drive.test/invite/1"),
  ],
] as const;

describe.each(templates)("%s email", (_label, render) => {
  const html = render(HOSTILE);

  it("escapes the markup the name carries", () => {
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("escapes ampersands and quotes rather than dropping them", () => {
    expect(html).toContain("&amp;");
    expect(html).toContain("&#39;co&#39;");
  });

  it("leaves an ordinary name readable", () => {
    expect(render("Ada Lovelace")).toContain("Ada Lovelace");
  });
});

describe("invitation email", () => {
  it("escapes the workspace name as well as the inviter", () => {
    const html = invitationEmailHtml(
      "Ada",
      `<img src=x onerror="alert(1)">`,
      "https://drive.test/i"
    );
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});
