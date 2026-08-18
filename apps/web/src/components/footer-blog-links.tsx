import { opinlyConfig } from "@opinly/next";
import Link from "next/link";
import { getOpinlyClient, opinlyEnabled } from "@/lib/opinly";

/**
 * The four most recent posts, in the footer of every marketing page.
 *
 * Not decoration: the footer linked /blog and nothing else, so every post was
 * two hops from the homepage and reachable through exactly one page. Search
 * Console reported the posts as discovered and left uncrawled while the pages
 * linked from the footer were indexed. A link from every page is the cheapest
 * way to say these are part of the site rather than an appendix to it.
 *
 * Never allowed to throw, for the same reason sitemap.ts isn't: this renders
 * inside a component that every marketing page mounts, and a blog fetch that
 * failed here would take the footer — and the page around it — with it. A bad
 * response costs four links until the cache next fills.
 */
export async function FooterBlogLinks() {
  if (!opinlyEnabled()) return null;

  let posts: Array<{ slug: string; title: string }> = [];
  try {
    posts = (await getOpinlyClient().posts({ limit: 4 })).data;
  } catch (err) {
    console.error("footer: opinly posts unavailable, omitting recent posts", err);
    return null;
  }
  if (posts.length === 0) return null;

  return (
    <nav aria-label="Latest posts" className="mt-8">
      <h3 className="text-sm font-medium">Latest posts</h3>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-stone-500">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`${opinlyConfig.blogPrefix}/${post.slug}`}
              className="transition-colors hover:text-stone-900"
            >
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
