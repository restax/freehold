/**
 * The "someone recommended Freehold to you" email, sent from /recommend's
 * send-it-for-you form and the /admin/recommendations composer.
 *
 * Deliberately styled as a personal note from Paul, not a marketing
 * template: Calibri on white, no branded envelope, no header bar, no
 * pricing cards, and a typed signature block with a real phone number.
 * The one-time-email disclosure stays as small grey text at the bottom;
 * it does real anti-spam work.
 *
 * The demo link's visible text must NOT look like a URL: an early version
 * showed "https://freeholdtc.dev" while the href carried the /rec/<token>
 * tracking path, and both Gmail and Hostinger accepted-then-vanished those
 * sends (URL-shaped text pointing at a different URL is a classic phishing
 * signature). Plain "click here" wording with the same tracked href
 * delivers fine.
 */

/** Where the tracked link in the email actually goes once opened. */
export function recommendClickUrl(token: string): string {
  return `https://freeholdtc.dev/rec/${token}`;
}

export function recommendationEmailSubject(): string {
  return "A quick intro to Freehold from Paul at the team";
}

export function recommendationEmailText(token: string): string {
  const url = recommendClickUrl(token);
  return `Hi,

My name is Paul Slazas. I'm on the team running Freehold, transaction management software for TCs and real estate teams. Someone who knows your business thought it might be a fit for you, so I wanted to reach out personally and ask you to please take a look.

Honestly, there are too many features to list in one email, so here are just the top 3:

1. Latest AI Models. Freehold runs on Claude, Anthropic's latest AI. Ask it about your transactions, clients, and contracts.

2. Real Website for your business, included. Every workspace gets its own public website and client portals. Not an upsell.

3. Doc Sign included! E-signatures ship with every plan. No separate account, no per-envelope fees.

The easiest way to see if it's for you is the live demo. No signup, just click and look around:

${url}

A couple things I want you to know up front: we have real tech support (you can even call me directly), and we never ask for a credit card to try it out. The free plan is actually free.

If you have any questions at all, just reply to this email or give me a call.

Thanks for your time,

Paul Slazas
Freehold
paul@freeholdtc.dev
774-240-4715
freeholdtc.dev

--
You're receiving this because someone recommended Freehold to you. This is a one-time email; nothing else follows unless you sign up yourself.`;
}

export function recommendationEmailHtml(token: string): string {
  const url = recommendClickUrl(token);
  const link = (href: string, text: string) =>
    `<a href="${href}" style="color:#0563c1;text-decoration:underline;">${text}</a>`;
  const p = (body: string, margin = "0 0 16px") => `<p style="margin:${margin};">${body}</p>`;

  return `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#ffffff;">
<div style="max-width:640px;font-family:Calibri,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#000000;">
${p("Hi,")}
${p(
  "My name is Paul Slazas. I'm on the team running Freehold, transaction management software for TCs and real estate teams. Someone who knows your business thought it might be a fit for you, so I wanted to reach out personally and ask you to please take a look.",
)}
${p("Honestly, there are too many features to list in one email, so here are just the top 3:")}
${p(
  "1. <b>Latest AI Models.</b> Freehold runs on Claude, Anthropic's latest AI. Ask it about your transactions, clients, and contracts.",
  "0 0 8px",
)}
${p(
  "2. <b>Real Website for your business, included.</b> Every workspace gets its own public website and client portals. Not an upsell.",
  "0 0 8px",
)}
${p(
  "3. <b>Doc Sign included!</b> E-signatures ship with every plan. No separate account, no per-envelope fees.",
)}
${p(`The easiest way to see if it's for you is the live demo. No signup, ${link(url, "just click here to see it")} and look around.`)}
${p(
  "A couple things I want you to know up front: we have real tech support (you can even call me directly), and we never ask for a credit card to try it out. The free plan is actually free.",
)}
${p("If you have any questions at all, just reply to this email or give me a call.")}
${p("Thanks for your time,")}
${p("Paul Slazas", "0 0 2px")}
${p("Freehold", "0 0 2px")}
${p(link("mailto:paul@freeholdtc.dev", "paul@freeholdtc.dev"), "0 0 2px")}
${p("774-240-4715", "0 0 2px")}
${p(link("https://freeholdtc.dev", "freeholdtc.dev"), "0 0 24px")}
<p style="margin:0;font-size:12px;color:#737373;">You're receiving this because someone recommended Freehold to you. This is a one-time email; nothing else follows unless you sign up yourself.</p>
</div>
</body>
</html>`;
}
