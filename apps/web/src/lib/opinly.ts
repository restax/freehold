import { createOpinlyClient } from "@opinly/backend";

// `force-cache` puts responses in the data cache; the `opinly` tag lets the
// webhook invalidate exactly what changed rather than guessing (see
// app/api/opinly/route.ts).
export const opinly = createOpinlyClient({
  fetch: (url, init) => fetch(url, { ...init, cache: "force-cache", next: { tags: ["opinly"] } }),
});
