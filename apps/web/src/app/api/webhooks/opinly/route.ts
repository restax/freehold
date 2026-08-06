import type { OpinlyWebhookEvent } from "@opinly/backend";
import { opinlyConfig } from "@opinly/next";
import { revalidatePath, revalidateTag } from "next/cache";
import { Webhook } from "svix";

export const dynamic = "force-dynamic";

const BLOG_PREFIX = opinlyConfig.blogPrefix;

/** Opinly webhook: invalidates the data cache and rendered blog routes on content changes. */
export async function POST(request: Request) {
  if (!process.env.OPINLY_WEBHOOK_SIGNING_SECRET) {
    return new Response("Opinly webhook not configured", { status: 503 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Invalid request", { status: 400 });
  }

  const buf = Buffer.from(await request.arrayBuffer());
  const wh = new Webhook(process.env.OPINLY_WEBHOOK_SIGNING_SECRET);

  let evt: OpinlyWebhookEvent;
  try {
    evt = wh.verify(buf, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as OpinlyWebhookEvent;
  } catch {
    return new Response("Error verifying webhook", { status: 400 });
  }

  if (evt.type !== "content.routes-changed") {
    return new Response("ok", { status: 200 });
  }

  // Data cache: every opinly.* fetch is tagged "opinly" (see lib/opinly.ts). One
  // call drops them all. `{ expire: 0 }` is required on Next 16+ and means "drop
  // now" — a named profile like "max" would keep serving stale posts for up to a
  // year while refreshing behind them, which is wrong right after a publish.
  revalidateTag("opinly", { expire: 0 });

  // Rendered routes: revalidatePath alone is a silent no-op for dynamically
  // rendered routes on this self-hosted deployment, so both are required.
  for (const route of evt.data.changed) {
    switch (route.type) {
      case "post":
        revalidatePath(`${BLOG_PREFIX}/${route.slug}`);
        break;
      case "category":
        revalidatePath(`${BLOG_PREFIX}/category/${route.slug}`);
        break;
      case "author":
        revalidatePath(`${BLOG_PREFIX}/authors/${route.slug}`);
        break;
      case "tag":
        revalidatePath(`${BLOG_PREFIX}/tag/${route.slug}`);
        break;
      case "home":
        revalidatePath(BLOG_PREFIX || "/");
        revalidatePath("/sitemap.xml");
        break;
    }
  }

  return new Response("ok", { status: 200 });
}
