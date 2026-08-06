import { createOpinlyClient, type OpinlyClient } from "@opinly/backend";

/** Whether an Opinly key is configured — bring-your-own, like every other provider here. Check this before touching the client so a missing key disables the blog/pixel instead of crashing the build. */
export function opinlyEnabled(): boolean {
  return Boolean(process.env.OPINLY_API_KEY);
}

let client: OpinlyClient | null = null;

/**
 * Lazily constructed: createOpinlyClient() throws synchronously if the key is
 * missing, and this module is imported by statically-generated routes
 * (sitemap.ts). Building it eagerly at module load would crash every build
 * that doesn't have OPINLY_API_KEY set — including CI, which never has
 * runtime secrets. Callers should check opinlyEnabled() first.
 *
 * `force-cache` puts responses in the data cache; the `opinly` tag lets the
 * webhook invalidate exactly what changed rather than guessing (see
 * app/api/webhooks/opinly/route.ts).
 */
export function getOpinlyClient(): OpinlyClient {
  client ??= createOpinlyClient({
    fetch: (url, init) => fetch(url, { ...init, cache: "force-cache", next: { tags: ["opinly"] } }),
  });
  return client;
}
