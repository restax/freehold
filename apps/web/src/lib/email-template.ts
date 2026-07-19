/**
 * HTML email rendering. Table-based layout (email clients ignore modern
 * CSS), deliberately image-free — a text wordmark, clean type, brand-green
 * accents. Every branded email carries the sender's signature block: the
 * TC's contact card, the client's agent/brokerage card, and a smaller
 * other-side card, with a "Powered by Freehold" footer.
 */

export interface EmailContact {
  heading: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface EmailRenderInput {
  tenantName: string;
  /** Plain-text body; paragraphs split on blank lines. */
  body: string;
  tc?: EmailContact | null;
  agent?: EmailContact | null;
  otherSide?: EmailContact | null;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function contactCell(c: EmailContact, small = false): string {
  const size = small ? "12px" : "13px";
  const nameSize = small ? "13px" : "14px";
  return `
    <td valign="top" style="padding:12px 16px;border:1px solid #e7e5e4;border-radius:8px;">
      <p style="margin:0 0 2px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#a8a29e;">${esc(c.heading)}</p>
      <p style="margin:0;font-size:${nameSize};font-weight:600;color:#1c1917;">${esc(c.name)}</p>
      ${c.company ? `<p style="margin:1px 0 0;font-size:${size};color:#57534e;">${esc(c.company)}</p>` : ""}
      ${c.email ? `<p style="margin:3px 0 0;font-size:${size};"><a href="mailto:${esc(c.email)}" style="color:#0b7a49;text-decoration:none;">${esc(c.email)}</a></p>` : ""}
      ${c.phone ? `<p style="margin:1px 0 0;font-size:${size};color:#57534e;">${esc(c.phone)}</p>` : ""}
    </td>`;
}

export function renderEmailHtml(input: EmailRenderInput): string {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#292524;">${esc(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");

  const cards: string[] = [];
  if (input.tc) cards.push(contactCell(input.tc));
  if (input.agent) cards.push(contactCell(input.agent));

  return `<!doctype html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr>
    <td style="background:#0b6a40;border-radius:12px 12px 0 0;padding:18px 28px;">
      <span style="font-size:17px;font-weight:700;color:#ffffff;font-family:Georgia,serif;letter-spacing:0.01em;">${esc(input.tenantName)}</span>
    </td>
  </tr>
  <tr>
    <td style="background:#ffffff;padding:28px 28px 8px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      ${paragraphs}
    </td>
  </tr>
  ${
    cards.length > 0
      ? `<tr><td style="background:#ffffff;padding:10px 28px 4px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        ${cards.join('<td style="width:12px;"></td>')}
      </tr></table>
    </td></tr>`
      : ""
  }
  ${
    input.otherSide
      ? `<tr><td style="background:#ffffff;padding:10px 28px 4px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="60%" cellpadding="0" cellspacing="0"><tr>
        ${contactCell(input.otherSide, true)}
      </tr></table>
    </td></tr>`
      : ""
  }
  <tr>
    <td style="background:#ffffff;border-radius:0 0 12px 12px;padding:18px 28px 22px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <p style="margin:0;border-top:1px solid #e7e5e4;padding-top:14px;font-size:11px;color:#a8a29e;">
        Powered by <a href="https://freeholdtc.dev" style="color:#78716c;text-decoration:none;font-weight:600;">Freehold</a>
        — reply to this email and it lands right back on your file.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ---------- automated-email templates ----------

export interface EmailTemplateDef {
  subject: string;
  body: string;
}

export interface TenantEmailTemplates {
  intro: EmailTemplateDef;
  postClose: EmailTemplateDef;
}

export const EMAIL_MERGE_CODES = [
  "{{client_name}}",
  "{{property_address}}",
  "{{close_date}}",
  "{{contract_date}}",
  "{{tc_name}}",
  "{{tenant_name}}",
] as const;

export const DEFAULT_EMAIL_TEMPLATES: TenantEmailTemplates = {
  intro: {
    subject: "Your file is open: {{property_address}}",
    body: `Hi {{client_name}},

{{tenant_name}} has opened the transaction file for {{property_address}}. From here we track every date, document, and deadline so nothing slips.

You'll hear from us at each milestone, and you can reply to any of these emails — replies land directly on the file.

Talk soon,
{{tc_name}}`,
  },
  postClose: {
    subject: "Closed: {{property_address}} 🎉",
    body: `Hi {{client_name}},

{{property_address}} is officially closed as of {{close_date}}. Congratulations!

All documents stay available in your portal, and we keep the full record on file. If anything comes up after closing, just reply to this email.

It was a pleasure working with you,
{{tc_name}}`,
  },
};

export function parseEmailTemplates(raw: unknown): TenantEmailTemplates {
  const c = raw as Partial<Record<"intro" | "postClose", Partial<EmailTemplateDef>>> | null;
  return {
    intro: {
      subject: c?.intro?.subject?.trim() || DEFAULT_EMAIL_TEMPLATES.intro.subject,
      body: c?.intro?.body?.trim() || DEFAULT_EMAIL_TEMPLATES.intro.body,
    },
    postClose: {
      subject: c?.postClose?.subject?.trim() || DEFAULT_EMAIL_TEMPLATES.postClose.subject,
      body: c?.postClose?.body?.trim() || DEFAULT_EMAIL_TEMPLATES.postClose.body,
    },
  };
}

export function renderMerge(
  template: string,
  ctx: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => ctx[key] ?? "");
}
