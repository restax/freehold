import { getSession } from "@/lib/session";

/**
 * Platform-operator access: the /admin surface crosses tenant walls on
 * purpose (read-only), so it is gated to the emails in
 * PLATFORM_ADMIN_EMAILS (comma-separated). Unset — the default on every
 * self-hosted install — means no one is an operator and /admin 404s.
 */
export function operatorEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function isOperator(): Promise<boolean> {
  const allowed = operatorEmails();
  if (allowed.length === 0) return false;
  const session = await getSession();
  const email = session?.user.email?.toLowerCase();
  return Boolean(email && allowed.includes(email));
}
