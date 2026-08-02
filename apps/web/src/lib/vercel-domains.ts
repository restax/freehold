/**
 * The Vercel Domains API, just enough of it to attach a workspace's own
 * hostname to this deployment.
 *
 * Arm's-length HTTP, no SDK: three endpoints and a bearer token don't justify
 * a dependency, and this way the whole surface Freehold depends on is visible
 * in one file.
 *
 * Self-hosters won't have these env vars, and shouldn't need them — they point
 * their own wildcard DNS at their install and the middleware does the rest.
 * `vercelDomainsConfigured()` is what the UI checks before offering any of it.
 */

const API = "https://api.vercel.com";

export interface VercelDomainStatus {
  /** Vercel has confirmed ownership (the domain resolves to this project). */
  verified: boolean;
  /** DNS isn't pointing here yet — the common "waiting on the registrar" state. */
  misconfigured: boolean;
  /** The registrable domain, e.g. smithtc.com for www.smithtc.com. */
  apexName: string | null;
  /** Whatever Vercel said is still wrong, for showing to the admin verbatim. */
  note: string | null;
}

export function vercelDomainsConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
}

function credentials() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) throw new Error("Vercel domain management is not configured.");
  // Project-scoped calls need the team when the project belongs to one.
  const team = process.env.VERCEL_TEAM_ID;
  return { token, projectId, query: team ? `?teamId=${encodeURIComponent(team)}` : "" };
}

async function call(
  path: string,
  init: RequestInit & { token: string },
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${init.token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // A 204 or an HTML error page — the status is the whole answer.
  }
  return { ok: res.ok, status: res.status, body };
}

function apiError(body: Record<string, unknown>): string | null {
  const err = body.error as { message?: string; code?: string } | undefined;
  return err?.message ?? (err?.code ? String(err.code) : null);
}

/**
 * Whether this project already answers for the domain.
 *
 * Used as a guard before adding: everything already attached here is either
 * the platform's own (freeholdtc.dev, the preview host, the deployment URL) or
 * another workspace's, and neither is a new claimant's to take. Without this
 * the only thing standing between a workspace and "www.freeholdtc.dev" is
 * BETTER_AUTH_URL being set to the real host — one layer, and a config-shaped
 * one at that.
 */
export async function vercelDomainAttached(domain: string): Promise<boolean> {
  const { token, projectId, query } = credentials();
  const res = await call(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${query}`,
    { token, method: "GET" },
  );
  return res.ok;
}

/**
 * Attach the domain to the project. Vercel starts issuing a certificate as
 * soon as DNS resolves here, so nothing else has to happen on our side.
 *
 * A domain already attached to *this* project is success, not an error —
 * re-adding after a failed check is the natural thing for an admin to do.
 * Callers must have established that the domain is theirs to re-add (see
 * vercelDomainAttached), because this call alone cannot tell "mine again"
 * from "someone else's".
 */
export async function addVercelDomain(
  domain: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { token, projectId, query } = credentials();
  const res = await call(`/v10/projects/${encodeURIComponent(projectId)}/domains${query}`, {
    token,
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
  if (res.ok) return { ok: true };

  const code = (res.body.error as { code?: string } | undefined)?.code;
  if (code === "domain_already_in_use_by_this_project") return { ok: true };
  if (code === "domain_already_in_use") {
    return {
      ok: false,
      error: "That domain is already connected to another site. Remove it there first.",
    };
  }
  return { ok: false, error: apiError(res.body) ?? `Vercel rejected that domain (${res.status}).` };
}

/**
 * Where the domain stands. Two calls because Vercel splits the answer: the
 * project endpoint knows whether ownership is verified, and the config
 * endpoint knows whether DNS actually points here. A domain is only really
 * working when both agree.
 */
export async function vercelDomainStatus(domain: string): Promise<VercelDomainStatus> {
  const { token, projectId, query } = credentials();
  const enc = encodeURIComponent(domain);

  const project = await call(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${enc}${query}`,
    {
      token,
      method: "GET",
    },
  );
  if (!project.ok) {
    return {
      verified: false,
      misconfigured: true,
      apexName: null,
      note: apiError(project.body) ?? "That domain isn't attached to this site yet.",
    };
  }

  const verified = project.body.verified === true;
  const apexName = typeof project.body.apexName === "string" ? project.body.apexName : null;

  const config = await call(`/v6/domains/${enc}/config${query}`, { token, method: "GET" });
  const misconfigured = config.ok ? config.body.misconfigured === true : true;

  // Vercel returns the outstanding ownership challenge when there is one; it's
  // the most useful thing we can put in front of an admin who is stuck.
  const challenge = Array.isArray(project.body.verification)
    ? (project.body.verification[0] as { reason?: string } | undefined)
    : undefined;

  return {
    verified,
    misconfigured,
    apexName,
    note: !verified
      ? (challenge?.reason ?? "Waiting for the domain to be verified.")
      : misconfigured
        ? "DNS isn't pointing here yet. It can take up to an hour after you add the record."
        : null,
  };
}

/** Detach the domain. A domain that was never attached is already detached. */
export async function removeVercelDomain(domain: string): Promise<void> {
  const { token, projectId, query } = credentials();
  await call(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${query}`,
    { token, method: "DELETE" },
  );
}
