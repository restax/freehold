/**
 * Platform-level email (verification codes, operator notices) — sent from
 * Freehold itself, not from a tenant's workspace address. Requires the same
 * Resend setup as tenant email.
 */
export function platformEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM_DOMAIN);
}

export async function sendPlatformEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<void> {
  if (!platformEmailEnabled()) throw new Error("Platform email is not configured.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Freehold <no-reply@${process.env.EMAIL_FROM_DOMAIN}>`,
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Platform email failed: ${res.status}`);
}
