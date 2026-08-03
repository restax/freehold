/**
 * The "someone recommended Freehold to you" email, sent from /recommend's
 * send-it-for-you form. Platform-level, not tied to any workspace, so it
 * uses the same forest-green accent every other unbranded system email uses
 * (daily briefing, invoice report) and the same envelope chrome, rather than
 * resolving a tenant's theme.
 */
import { esc, renderBrandedEnvelope } from "./email-template";
import { PLAN_INFO } from "./plans";
import { type EmailAccent, resolveEmailAccent } from "./theme";

const ACCENT: EmailAccent = resolveEmailAccent({ theme: "forest", customAccent: "" });

/** Where the tracked link in the email actually goes once opened. */
export function recommendClickUrl(token: string): string {
  return `https://freeholdtc.dev/rec/${token}`;
}

const FEATURES = [
  [
    "AI: Freehold runs on Claude, Anthropic's AI.",
    "Built in, not a bolt-on. Ask AI about your transactions, clients and contracts.",
  ],
  [
    "Document Signing is included",
    "OpenSign e-signatures ship with every plan. No separate account, no per-envelope fee.",
  ],
  [
    "Web Hosting Plans Included",
    "Every workspace gets its own public site and portal links, included, not an upsell.",
  ],
] as const;

function priceCell(tier: "FREE" | "PRO" | "BUSINESS"): string {
  const info = PLAN_INFO[tier];
  const price = info.priceMonthly === 0 ? "Free" : `$${info.priceMonthly}/mo`;
  const txns =
    info.activeTransactionLimit == null
      ? "Unlimited files"
      : `${info.activeTransactionLimit} active files`;
  return `
    <td valign="top" width="33%" style="padding:10px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e7e5e4;border-radius:10px;">
        <tr><td style="padding:14px 12px;text-align:center;">
          <p style="margin:0 0 2px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a29e;">${esc(info.label)}</p>
          <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#1c1917;">${price}</p>
          <p style="margin:0;font-size:11px;line-height:1.5;color:#78716c;">${esc(txns)}</p>
        </td></tr>
      </table>
    </td>`;
}

export function recommendationEmailSubject(): string {
  return "Someone thought you'd want to see Freehold";
}

export function recommendationEmailText(token: string): string {
  const url = recommendClickUrl(token);
  return `Recommended by a friend.

Someone who uses Freehold thought it might help your business too. It's a real estate transaction coordination platform built around three things:

AI: Freehold runs on Claude, Anthropic's AI. Built in, not a bolt-on. Ask AI about your transactions, clients and contracts.

Document Signing is included: OpenSign e-signatures ship with every plan. No separate account, no per-envelope fee.

Web Hosting Plans Included: every workspace gets its own public site and portal links, included, not an upsell.

Free: $0/mo, 2 active files
Pro: $50/mo, 8 active files
Business: $80/mo, unlimited files

See the live demo: ${url}

Freehold is also free to self-host, forever, if you'd rather run it yourself: https://github.com/restax/freehold

You're receiving this because someone recommended Freehold to you. This is a one-time email; nothing else will follow unless you sign up yourself.`;
}

export function recommendationEmailHtml(token: string): string {
  const url = recommendClickUrl(token);
  const featureRows = FEATURES.map(
    ([title, body]) => `
    <tr>
      <td style="padding:0 0 14px;">
        <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#1c1917;">${esc(title)}</p>
        <p style="margin:0;font-size:13px;line-height:1.55;color:#57534e;">${esc(body)}</p>
      </td>
    </tr>`,
  ).join("");

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#292524;">
      Someone who uses Freehold thought it might help your business too. It's a real estate
      transaction coordination platform built around three things:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
      ${featureRows}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr><td style="background:${ACCENT.header};border-radius:8px;">
        <a href="${url}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:${ACCENT.headerFg};text-decoration:none;">See the live demo</a>
      </td></tr>
    </table>
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a29e;">Plans</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr>${priceCell("FREE")}${priceCell("PRO")}${priceCell("BUSINESS")}</tr>
    </table>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#78716c;">
      Freehold is also free to self-host, forever, if you'd rather run it yourself:
      <a href="https://github.com/restax/freehold" style="color:${ACCENT.link};text-decoration:none;">github.com/restax/freehold</a>.
    </p>`;

  return renderBrandedEnvelope({
    tenantName: "Freehold, Software for TC's",
    subtitle: "Recommended by a friend.",
    accent: ACCENT,
    bodyHtml,
    footerHtml:
      "You're receiving this because someone recommended Freehold to you. This is a one-time email; nothing else follows unless you sign up yourself.",
  });
}
