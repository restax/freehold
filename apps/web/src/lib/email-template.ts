// Relative, not "@/lib/theme": this module is unit-tested and vitest runs
// without the Next path aliases.
import { type EmailAccent, resolveEmailAccent } from "./theme";

/**
 * HTML email rendering. Table-based layout (email clients ignore modern
 * CSS), deliberately image-free — a text wordmark, clean type. The accent
 * follows the workspace's Appearance setting, the same colour that themes
 * the dashboard — see [resolveEmailAccent]. Every branded email carries the
 * sender's signature block: the TC's contact card, the client's
 * agent/brokerage card, and a smaller other-side card, with a
 * "Powered by Freehold" footer.
 */

/** The default green, used only where no workspace theme is available to
 *  resolve (a preview render with no tenant, for instance). */
const FALLBACK_ACCENT: EmailAccent = resolveEmailAccent({ theme: "forest", customAccent: "" });

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
  /** Workspace signature (markdown-lite), rendered under the body. */
  signature?: string | null;
  /** Workspace footer line, rendered above the powered-by line. */
  footer?: string | null;
  /** Resolved from the workspace's Appearance setting — see
   *  [resolveEmailAccent]. Falls back to the default green when omitted. */
  accent?: EmailAccent | null;
}

/** Workspace-wide signature + footer, stored on organization.emailSettings. */
export interface EmailSettings {
  signature?: string;
  footer?: string;
  /** Address the workspace CCs on all transaction email (copy-to-clipboard in the UI). */
  cc?: string;
  /** Days after close before the review ask goes out. Unset = 3. */
  reviewDelayDays?: number;
}

export function parseEmailSettings(raw: unknown): EmailSettings {
  const c = raw as EmailSettings | null;
  const days = Number(c?.reviewDelayDays);
  return {
    signature: c?.signature ?? "",
    footer: c?.footer ?? "",
    cc: c?.cc ?? "",
    reviewDelayDays: Number.isFinite(days) && days > 0 ? Math.round(days) : 3,
  };
}

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function contactCell(c: EmailContact, accent: EmailAccent, small = false): string {
  const size = small ? "12px" : "13px";
  const nameSize = small ? "13px" : "14px";
  return `
    <td valign="top" style="padding:12px 16px;border:1px solid #e7e5e4;border-radius:8px;">
      <p style="margin:0 0 2px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#a8a29e;">${esc(c.heading)}</p>
      <p style="margin:0;font-size:${nameSize};font-weight:600;color:#1c1917;">${esc(c.name)}</p>
      ${c.company ? `<p style="margin:1px 0 0;font-size:${size};color:#57534e;">${esc(c.company)}</p>` : ""}
      ${c.email ? `<p style="margin:3px 0 0;font-size:${size};"><a href="mailto:${esc(c.email)}" style="color:${accent.link};text-decoration:none;">${esc(c.email)}</a></p>` : ""}
      ${c.phone ? `<p style="margin:1px 0 0;font-size:${size};color:#57534e;">${esc(c.phone)}</p>` : ""}
    </td>`;
}

/**
 * Markdown-lite → email-safe HTML. Deliberately tiny (an embedded rich-text
 * editor is unreliable across email clients and browsers): **bold**,
 * _italic_, "# " large / "## " medium headings, "- " bullet lists,
 * "[text](url)" links, "![alt](url)" images (their own block), blank lines
 * for paragraphs. Everything else renders literally.
 */
function inline(text: string, linkColor: string): string {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\b_([^_]+)_\b/g, "<em>$1</em>")
    .replace(
      /\[([^\]]*)\]\(([^)\s]+)\)/g,
      `<a href="$2" style="color:${linkColor};text-decoration:underline;">$1</a>`,
    );
}

const IMAGE_BLOCK = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

export function renderLiteMarkdown(body: string, accent: EmailAccent = FALLBACK_ACCENT): string {
  const blocks = body
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const image = block.match(IMAGE_BLOCK);
      if (image) {
        return `<img src="${esc(image[2] ?? "")}" alt="${esc(image[1] ?? "")}" style="max-width:100%;height:auto;border-radius:8px;margin:0 0 14px;display:block;" />`;
      }
      if (lines.every((l) => l.trim().startsWith("- "))) {
        const items = lines
          .map((l) => `<li style="margin:0 0 6px;">${inline(l.trim().slice(2), accent.link)}</li>`)
          .join("");
        return `<ul style="margin:0 0 14px;padding-left:22px;font-size:15px;line-height:1.6;color:#292524;">${items}</ul>`;
      }
      if (block.startsWith("!! ")) {
        // Warning callout — an amber panel, e.g. the wire-fraud notice on the
        // closing email. Renders reliably across email clients (table + inline).
        // Deliberately not themed: amber reads as "caution" universally, and
        // tying it to the accent would mute that on a workspace whose accent
        // is itself warm (Clay, Garnet).
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.6;color:#78350f;">${inline(block.slice(3), accent.link).replace(/\n/g, "<br/>")}</td></tr></table>`;
      }
      if (block.startsWith("## ")) {
        return `<p style="margin:0 0 10px;font-size:17px;font-weight:600;color:#1c1917;">${inline(block.slice(3), accent.link)}</p>`;
      }
      if (block.startsWith("# ")) {
        return `<p style="margin:0 0 10px;font-size:20px;font-weight:700;color:#1c1917;">${inline(block.slice(2), accent.link)}</p>`;
      }
      return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#292524;">${inline(block, accent.link).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
}

export function renderEmailHtml(input: EmailRenderInput): string {
  const accent = input.accent ?? FALLBACK_ACCENT;
  const paragraphs =
    renderLiteMarkdown(input.body, accent) +
    (input.signature?.trim()
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e7e5e4;padding-top:12px;">${renderLiteMarkdown(input.signature, accent)}</td></tr></table>`
      : "");

  const cards: string[] = [];
  if (input.tc) cards.push(contactCell(input.tc, accent));
  if (input.agent) cards.push(contactCell(input.agent, accent));

  return `<!doctype html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr>
    <td style="background:${accent.header};border-radius:12px 12px 0 0;padding:18px 28px;">
      <span style="font-size:17px;font-weight:700;color:${accent.headerFg};font-family:Georgia,serif;letter-spacing:0.01em;">${esc(input.tenantName)}</span>
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
        ${contactCell(input.otherSide, accent, true)}
      </tr></table>
    </td></tr>`
      : ""
  }
  <tr>
    <td style="background:#ffffff;border-radius:0 0 12px 12px;padding:18px 28px 22px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      ${
        input.footer?.trim()
          ? `<p style="margin:0 0 8px;border-top:1px solid #e7e5e4;padding-top:14px;font-size:11px;line-height:1.5;color:#78716c;">${esc(input.footer)}</p>`
          : ""
      }
      <p style="margin:0;${input.footer?.trim() ? "" : "border-top:1px solid #e7e5e4;padding-top:14px;"}font-size:11px;color:#a8a29e;">
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

export interface EmailEnvelopeInput {
  tenantName: string;
  /** e.g. "Daily transaction briefing · Friday, July 31" — under the wordmark. */
  subtitle: string;
  accent: EmailAccent;
  /** Optional "why am I getting this" banner, tinted with the accent. Raw HTML. */
  explainerHtml?: string;
  /** The body, already rendered — these callers build their own cards/tables
   *  rather than markdown-lite, so this takes HTML directly. */
  bodyHtml: string;
  /** Small print above the "Powered by Freehold" line. Raw HTML. */
  footerHtml: string;
  /** Card width in px. 640 for the denser briefing tables, 600 elsewhere. */
  width?: number;
}

/**
 * The header/footer chrome shared by system emails that don't carry a
 * TC/agent signature block — the daily briefing and the invoice report.
 * `renderEmailHtml` above owns that block's layout, which these emails have
 * no use for; this is the other half of the same envelope, so both still
 * read as the same product and neither hardcodes its own copy of the accent.
 */
export function renderBrandedEnvelope(input: EmailEnvelopeInput): string {
  const { accent, width = 600 } = input;
  return `<!doctype html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="${width}" cellpadding="0" cellspacing="0" style="max-width:${width}px;width:100%;">
  <tr>
    <td style="background:${accent.header};border-radius:12px 12px 0 0;padding:18px 24px;">
      <span style="font-size:17px;font-weight:700;color:${accent.headerFg};font-family:Georgia,serif;letter-spacing:0.01em;">${esc(input.tenantName)}</span>
      <p style="margin:2px 0 0;font-size:12px;color:${accent.headerFg};opacity:0.85;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">${esc(input.subtitle)}</p>
    </td>
  </tr>
  ${
    input.explainerHtml
      ? `<tr><td style="background:${accent.tint};padding:10px 24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
      <p style="margin:0;font-size:12px;line-height:1.5;color:${accent.tintFg};">${input.explainerHtml}</p>
    </td></tr>`
      : ""
  }
  <tr>
    <td style="background:#ffffff;padding:18px 24px 6px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1c1917;">
      ${input.bodyHtml}
    </td>
  </tr>
  <tr>
    <td style="background:#ffffff;border-radius:0 0 12px 12px;padding:14px 24px 20px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
      <p style="margin:0 0 4px;border-top:1px solid #e7e5e4;padding-top:12px;font-size:11px;line-height:1.6;color:#78716c;">
        ${input.footerHtml}
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#a8a29e;">
        Powered by <a href="https://freeholdtc.dev" style="color:#78716c;text-decoration:none;font-weight:600;">Freehold</a>
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
  review: EmailTemplateDef;
}

export const EMAIL_MERGE_CODES = [
  "{{client_name}}",
  "{{property_address}}",
  "{{close_date}}",
  "{{contract_date}}",
  "{{tc_name}}",
  "{{tenant_name}}",
  "{{buyer_name}}",
  "{{seller_name}}",
  "{{buyer_agent_name}}",
  "{{listing_agent_name}}",
  "{{lender_name}}",
  "{{title_company_name}}",
  "{{task_title}}",
  "{{task_due}}",
  "{{review_link}}",
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
  review: {
    subject: "How did we do on {{property_address}}?",
    body: `Hi {{client_name}},

Now that {{property_address}} has closed, we'd love to hear how it went — for us, and for {{tc_name}} specifically. It takes under a minute:

{{review_link}}

Thank you for the business,
{{tenant_name}}`,
  },
};

export function parseEmailTemplates(raw: unknown): TenantEmailTemplates {
  const c = raw as Partial<
    Record<"intro" | "postClose" | "review", Partial<EmailTemplateDef>>
  > | null;
  return {
    intro: {
      subject: c?.intro?.subject?.trim() || DEFAULT_EMAIL_TEMPLATES.intro.subject,
      body: c?.intro?.body?.trim() || DEFAULT_EMAIL_TEMPLATES.intro.body,
    },
    postClose: {
      subject: c?.postClose?.subject?.trim() || DEFAULT_EMAIL_TEMPLATES.postClose.subject,
      body: c?.postClose?.body?.trim() || DEFAULT_EMAIL_TEMPLATES.postClose.body,
    },
    review: {
      subject: c?.review?.subject?.trim() || DEFAULT_EMAIL_TEMPLATES.review.subject,
      body: c?.review?.body?.trim() || DEFAULT_EMAIL_TEMPLATES.review.body,
    },
  };
}

export function renderMerge(
  template: string,
  ctx: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => ctx[key] ?? "");
}
