import {
  Buildings,
  DownloadSimple,
  Image as ImageIcon,
  Sparkle,
  UserCircle,
  VideoCamera,
  YoutubeLogo,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { isOperator } from "@/lib/operator";
import {
  ASSET_GROUPS,
  DEMO_VIDEOS,
  PRESENTER_PROMPTS,
  SOCIAL_POSTS,
  type SocialPost,
} from "@/lib/social-kit";
import { btnGhost, card } from "@/lib/ui";

export const dynamic = "force-dynamic";

const DIR = "/marketing/social";

/**
 * The campaign kit: everything needed to post about Freehold, in one place.
 *
 * Operator-only, and deliberately a working surface rather than a document —
 * the copy buttons and download links are the whole point. Nothing here is
 * stored in the database; the posts and the manifest live in lib/social-kit.ts
 * so their claims can be unit-tested against what the product actually does.
 */
export default async function AdminSocialPage() {
  if (!(await isOperator())) notFound();

  const byVoice = (voice: "founder" | "company", length: "short" | "long") =>
    SOCIAL_POSTS.filter((p) => p.voice === voice && p.length === length);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <Link href="/admin" className="text-sm text-brand-700 hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Social media kit</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-600">
          {SOCIAL_POSTS.length} ready-to-post messages,{" "}
          {ASSET_GROUPS.reduce((n, g) => n + g.items.length, 0)} images, and {DEMO_VIDEOS.length}{" "}
          narrated demo videos. Copy a post, grab the image next to it, and go. Every claim here
          matches what the site says today.
        </p>
      </div>

      {/* Founder voice ----------------------------------------------------- */}
      <section className={card}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 font-medium">
            <UserCircle size={18} weight="fill" className="text-brand-700" aria-hidden />
            Founder voice
            <span className="text-sm font-normal text-stone-400">
              {byVoice("founder", "short").length + byVoice("founder", "long").length}
            </span>
          </h2>
          <p className="text-xs text-stone-500">Paul only. These say &ldquo;I built this&rdquo;.</p>
        </div>
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-stone-600">
          First person, from the person who made it. This is the voice that works in a group where
          people are wary of being sold to, because it is someone asking for an opinion rather than
          a brand talking.
        </p>
        <PostGrid title="Short" posts={byVoice("founder", "short")} />
        <PostGrid title="Longer" posts={byVoice("founder", "long")} stacked />
      </section>

      {/* Company voice ----------------------------------------------------- */}
      <section className={card}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 font-medium">
            <Buildings size={18} weight="fill" className="text-brand-700" aria-hidden />
            Company voice
            <span className="text-sm font-normal text-stone-400">
              {byVoice("company", "short").length + byVoice("company", "long").length}
            </span>
          </h2>
          <p className="text-xs text-stone-500">For a sales rep, or the brand account.</p>
        </div>
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-stone-600">
          Same claims, no first-person authorship. Anyone on the team can post these without
          pretending to have built the product. Use these on the Freehold page and anywhere a rep is
          posting under their own name.
        </p>
        <PostGrid title="Short" posts={byVoice("company", "short")} />
        <PostGrid title="Longer" posts={byVoice("company", "long")} stacked />
      </section>

      {/* Videos ------------------------------------------------------------ */}
      <section className={card}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 font-medium">
            <YoutubeLogo size={18} weight="fill" className="text-brand-700" aria-hidden />
            Demo videos
          </h2>
          <p className="text-xs text-stone-500">1920 x 1080 · H.264 mp4 · narrated</p>
        </div>
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-stone-600">
          Screen recordings of the real product with sample data, with a voiceover. Upload straight
          to YouTube. The narration script sits beside each one if you want captions or to re-record
          it in your own voice.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {DEMO_VIDEOS.map((v) => (
            <div key={v.file} className="overflow-hidden rounded-xl border border-stone-200">
              {/* biome-ignore lint/a11y/useMediaCaption: the narration script
                  is published beside each file; these are silent-safe demos. */}
              <video
                src={`${DIR}/video/${v.file}`}
                controls
                preload="metadata"
                className="w-full bg-stone-900"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{v.title}</p>
                  <p className="text-xs text-stone-400">
                    {v.seconds}s · {v.file}
                  </p>
                </div>
                <span className="flex items-center gap-1.5">
                  <a href={`${DIR}/video/${v.script}`} className={`${btnGhost} px-2 py-1 text-xs`}>
                    Script
                  </a>
                  <a
                    href={`${DIR}/video/${v.file}`}
                    download
                    className={`${btnGhost} px-2 py-1 text-xs`}
                  >
                    <DownloadSimple size={13} className="mr-1 inline" aria-hidden />
                    Download
                  </a>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Images ------------------------------------------------------------ */}
      {ASSET_GROUPS.map((group) => (
        <section key={group.title} className={card}>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 font-medium">
              <ImageIcon size={17} weight="fill" className="text-brand-700" aria-hidden />
              {group.title}
              <span className="text-sm font-normal text-stone-400">{group.items.length}</span>
            </h2>
          </div>
          <p className="mb-4 text-sm text-stone-600">{group.note}</p>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {group.items.map((item) => (
              <figure key={item.file} className="flex flex-col">
                <a
                  href={`${DIR}/${item.file}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border border-stone-200 bg-stone-100 transition hover:border-brand-300"
                >
                  <Image
                    src={`${DIR}/${item.file}`}
                    alt={item.label}
                    width={480}
                    height={300}
                    className="h-32 w-full object-cover object-left-top"
                    unoptimized
                  />
                </a>
                <figcaption className="mt-1.5 flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-stone-700">
                      {item.label}
                    </span>
                    {item.size && <span className="text-[11px] text-stone-400">{item.size}</span>}
                  </span>
                  <a
                    href={`${DIR}/${item.file}`}
                    download
                    aria-label={`Download ${item.label}`}
                    className="shrink-0 rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-brand-700"
                  >
                    <DownloadSimple size={15} aria-hidden />
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}

      {/* Presenter photos: the one thing that has to be made elsewhere ----- */}
      <section className={card}>
        <h2 className="flex items-center gap-2 font-medium">
          <Sparkle size={17} weight="fill" className="text-brand-700" aria-hidden />
          Presenter photos
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-600">
          These have to be generated outside Freehold, in Higgsfield or whichever image tool you
          prefer. The trick to getting the same woman every time is to keep the character paragraph
          word-for-word identical and change only the scene sentence, then feed the first image back
          in as a character reference for the rest.
        </p>
        <div className="mt-4 rounded-xl border border-brand-600/20 bg-brand-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Character (paste this into every prompt)</h3>
            <CopyButton text={PRESENTER_PROMPTS.character} label="Copy character" variant="quiet" />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-stone-700">
            {PRESENTER_PROMPTS.character}
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PRESENTER_PROMPTS.shots.map((s) => (
            <div key={s.label} className="rounded-xl border border-stone-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{s.label}</h3>
                <CopyButton
                  text={`${PRESENTER_PROMPTS.character} She is ${s.prompt}`}
                  label="Copy full prompt"
                  variant="quiet"
                />
              </div>
              <p className="mt-1 text-xs text-stone-400">{s.use}</p>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">She is {s.prompt}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-stone-500">
          {PRESENTER_PROMPTS.howTo}
        </p>
      </section>

      {/* How the assets were made, so they can be remade ------------------- */}
      <section className={card}>
        <h2 className="flex items-center gap-2 font-medium">
          <VideoCamera size={17} weight="fill" className="text-brand-700" aria-hidden />
          Remaking these
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-600">
          Every screenshot and video on this page was captured from the demo workspace by script, so
          they can be regenerated whenever the product changes rather than going stale. The
          screenshots and covers come from Playwright; the videos are Playwright recordings
          converted with ffmpeg; the voiceover is ElevenLabs. Ask Claude to re-run the social asset
          pipeline and everything here is rebuilt from the current UI.
        </p>
      </section>
    </div>
  );
}

function PostGrid({
  title,
  posts,
  stacked = false,
}: {
  title: string;
  posts: SocialPost[];
  stacked?: boolean;
}) {
  if (posts.length === 0) return null;
  return (
    <div className={stacked ? "mt-5" : ""}>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
        {title} · {posts.length}
      </h3>
      <div className={stacked ? "flex flex-col gap-3" : "grid gap-3 lg:grid-cols-2"}>
        {posts.map((p) => (
          <PostCard key={p.id} post={p} wide={stacked} />
        ))}
      </div>
    </div>
  );
}

function PostCard({ post, wide = false }: { post: SocialPost; wide?: boolean }) {
  return (
    <article className="flex flex-col rounded-xl border border-stone-200 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-600/10 px-2 py-0.5 text-[11px] font-medium text-brand-700">
          {post.angle}
        </span>
        <span className="text-[11px] text-stone-400">{post.audience}</span>
        <span className="ml-auto flex items-center gap-2">
          {post.suggestedAsset && (
            <a
              href={`${DIR}/${post.suggestedAsset}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-stone-500 underline decoration-stone-300 underline-offset-2 hover:text-brand-700"
            >
              {post.suggestedAsset.replace(/\.png$/, "")}
            </a>
          )}
          <CopyButton text={post.body} label="Copy" variant="quiet" />
        </span>
      </div>
      <p
        className={`whitespace-pre-wrap text-sm leading-relaxed text-stone-700 ${
          wide ? "" : "min-h-16"
        }`}
      >
        {post.body}
      </p>
    </article>
  );
}
