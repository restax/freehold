import type { AuthorPage, Authors, CategorySummary, FullPost, Post } from "@opinly/backend";
import {
  buildBlogPostingJsonLd,
  buildFaqJsonLd,
  formatDate,
  OpinlyJsonLd,
  opinlyConfig,
} from "@opinly/next";
import { authorPath, categoryPath, imageUrl, postPath } from "@opinly/shared";
import Image from "next/image";
import Link from "next/link";
import { PostContent } from "@/components/blog/post-content";

function PostCard({ post }: { post: Post }) {
  const cover = imageUrl(post.image?.fileKey, opinlyConfig);
  return (
    <Link
      href={postPath(opinlyConfig, post)}
      className="group block overflow-hidden rounded-2xl border border-stone-200/70 bg-white transition hover:border-brand-300 hover:shadow-sm"
    >
      {post.image?.fileKey ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-stone-100">
          <Image
            src={cover}
            alt={post.image.alt ?? post.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            sizes="(min-width: 768px) 33vw, 100vw"
          />
        </div>
      ) : null}
      <div className="p-5">
        {post.category ? (
          <span className="font-mono text-xs font-medium uppercase tracking-wide text-brand-700">
            {post.category.name}
          </span>
        ) : null}
        <h3 className="font-display mt-2 text-lg font-bold leading-snug tracking-tight text-stone-900">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-stone-600">
          {post.description}
        </p>
        <p className="mt-4 text-xs text-stone-400">{formatDate(post.firstPublishedAt)}</p>
      </div>
    </Link>
  );
}

export function BlogIndex({ data }: { data: { posts: Post[]; categories: CategorySummary[] } }) {
  return (
    <div>
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
          Blog
        </h1>
        <p className="mt-4 leading-relaxed text-stone-600">
          Notes on transaction coordination, real estate operations, and running Freehold.
        </p>
      </header>

      {data.categories.length > 0 ? (
        <nav className="mt-8 flex flex-wrap gap-2">
          {data.categories.map((c) => (
            <Link
              key={c.slug}
              href={categoryPath(opinlyConfig, c.slug)}
              className="rounded-full border border-stone-200 px-3 py-1 text-sm text-stone-600 transition hover:border-brand-300 hover:text-brand-700"
            >
              {c.title}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}

export function BlogPost({ post }: { post: FullPost }) {
  return (
    <article className="mx-auto max-w-2xl">
      <OpinlyJsonLd data={buildBlogPostingJsonLd(post)} />
      {post.faqs?.length ? <OpinlyJsonLd data={buildFaqJsonLd(post.faqs)} /> : null}
      {post.category ? (
        <Link
          href={categoryPath(opinlyConfig, post.category.slug)}
          className="font-mono text-xs font-medium uppercase tracking-wide text-brand-700"
        >
          {post.category.name}
        </Link>
      ) : null}
      <h1 className="font-display mt-3 text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
        {post.title}
      </h1>
      <div className="mt-4 flex items-center gap-3 text-sm text-stone-500">
        {post.author ? (
          <Link
            href={authorPath(opinlyConfig, post.author.slug)}
            className="font-medium text-stone-700 hover:text-brand-700"
          >
            {post.author.name}
          </Link>
        ) : null}
        <span>{formatDate(post.firstPublishedAt)}</span>
      </div>

      {post.titleFile?.fileKey ? (
        <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-2xl bg-stone-100">
          <Image
            src={imageUrl(post.titleFile.fileKey, opinlyConfig)}
            alt={post.titleFile.altText ?? post.title}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 672px, 100vw"
            priority
          />
        </div>
      ) : null}

      <div className="mt-10">
        <PostContent content={post.content} />
      </div>
    </article>
  );
}

export function CategoryView({
  category,
}: {
  category: CategorySummary & { name: string; posts: Post[] };
}) {
  return (
    <div>
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
          {category.name}
        </h1>
        {category.description ? (
          <p className="mt-4 leading-relaxed text-stone-600">{category.description}</p>
        ) : null}
      </header>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {category.posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}

export function AuthorView({
  author,
}: {
  author: Extract<AuthorPage, { type: "author" }>["data"];
}) {
  return (
    <div>
      <header className="flex items-center gap-4">
        {author.image?.fileKey ? (
          <div className="relative size-16 overflow-hidden rounded-full bg-stone-100">
            <Image
              src={imageUrl(author.image.fileKey, opinlyConfig)}
              alt={author.image.alt ?? author.name}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
        ) : null}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{author.name}</h1>
          {author.bio ? <p className="mt-1 text-sm text-stone-600">{author.bio}</p> : null}
        </div>
      </header>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {author.posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}

export function AuthorsView({ authors }: { authors: Authors["data"] }) {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
        Authors
      </h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {authors.map((author) => (
          <Link
            key={author.slug}
            href={authorPath(opinlyConfig, author.slug)}
            className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-4 transition hover:border-brand-300"
          >
            {author.image?.fileKey ? (
              <div className="relative size-12 overflow-hidden rounded-full bg-stone-100">
                <Image
                  src={imageUrl(author.image.fileKey, opinlyConfig)}
                  alt={author.image.alt ?? author.name}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
            ) : null}
            <div>
              <p className="font-medium text-stone-900">{author.name}</p>
              <p className="text-xs text-stone-500">{author.posts.length} posts</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
