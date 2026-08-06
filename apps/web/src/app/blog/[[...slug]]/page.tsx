import { generateOpinlyMetadata, opinlyConfig } from "@opinly/next";
import type { SeoResolved } from "@opinly/shared";
import type { ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import {
  AuthorsView,
  AuthorView,
  BlogIndex,
  BlogPost,
  CategoryView,
} from "@/components/blog/views";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { getOpinlyClient, opinlyEnabled } from "@/lib/opinly";

export const revalidate = 3600;

const categoryPrefix = opinlyConfig.categoryPrefix ?? "category";
const authorPrefix = opinlyConfig.authorPrefix ?? "authors";

type BlogPageProps = { params: Promise<{ slug?: string[] }> };

const loadRoute = async (slug: string[]) => {
  if (!opinlyEnabled()) return { type: "not-found" as const };
  const opinly = getOpinlyClient();
  if (slug.length === 0) {
    const [posts, categories] = await Promise.all([
      opinly.posts({ limit: 12 }),
      opinly.categories(),
    ]);
    return { type: "home" as const, data: { posts: posts.data, categories } };
  }
  if (slug[0] === categoryPrefix && slug[1]) {
    const [categories, list] = await Promise.all([
      opinly.categories(),
      opinly.posts({ category: slug[1] }),
    ]);
    const meta = categories.find((c) => c.slug === slug[1]);
    if (!meta) return { type: "not-found" as const };
    return { type: "category" as const, data: { ...meta, name: meta.title, posts: list.data } };
  }
  if (slug[0] === authorPrefix) {
    const authorSlug = slug[1];
    if (!authorSlug) return { type: "authors" as const, data: (await opinly.authors()).data };
    const author = await opinly.author(authorSlug);
    return author.type === "author"
      ? { type: "author" as const, data: author.data }
      : { type: "not-found" as const };
  }
  // Posts are flat: a single-segment slug. Anything deeper isn't a post route.
  if (slug.length !== 1) return { type: "not-found" as const };
  const post = await opinly.post(slug[0]);
  return post ? { type: "post" as const, data: post } : { type: "not-found" as const };
};

const toSeo = (route: Awaited<ReturnType<typeof loadRoute>>): SeoResolved => {
  switch (route.type) {
    case "post":
      return { type: "post", data: route.data };
    case "category":
      return { type: "category", data: route.data };
    case "author":
      return { type: "author", data: route.data };
    default:
      return { type: route.type };
  }
};

export const generateMetadata = async (props: BlogPageProps, parent: ResolvingMetadata) => {
  const { slug } = await props.params;
  return generateOpinlyMetadata(toSeo(await loadRoute(slug ?? [])), parent);
};

export default async function BlogPage(props: BlogPageProps) {
  const { slug } = await props.params;
  const route = await loadRoute(slug ?? []);

  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />
      <section className="mx-auto max-w-5xl px-4 pb-20 pt-12 sm:px-6 lg:pt-16">
        {route.type === "home" ? (
          <BlogIndex data={route.data} />
        ) : route.type === "post" ? (
          <BlogPost post={route.data} />
        ) : route.type === "category" ? (
          <CategoryView category={route.data} />
        ) : route.type === "author" ? (
          <AuthorView author={route.data} />
        ) : route.type === "authors" ? (
          <AuthorsView authors={route.data} />
        ) : (
          notFound()
        )}
      </section>
      <MarketingFooter />
    </main>
  );
}
