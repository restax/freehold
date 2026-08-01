import type { Metadata } from "next";
import Image from "next/image";
import { PRESENTER_PROMPTS } from "@/lib/social-kit";

/**
 * TEMPORARY. A public scratch page for looking at generated presenter images
 * without signing in — /admin/socialmedia is operator-gated, which makes
 * "just show me the picture" a whole login.
 *
 * Public on purpose, and noindex on purpose: unfinished marketing assets on a
 * live site should not be discoverable. /preview/ is disallowed in robots.ts
 * as well, so both the crawler hint and the meta tag say the same thing.
 *
 * Delete this route (and the images under public/marketing/social/presenter)
 * once the set is chosen and moved into the real asset gallery.
 */
export const metadata: Metadata = {
  title: "Presenter preview",
  robots: { index: false, follow: false },
};

const SHOTS = [
  {
    file: "/marketing/social/presenter/shot-1-freehold-onscreen.jpg",
    label: "Presenting to camera, Freehold on the screen",
    use: "Facebook page cover, video intro card",
    prompt: PRESENTER_PROMPTS.shots[0].prompt,
    note:
      "The laptop screen is a real screenshot of the transactions list, warped into " +
      "perspective and composited in. It is not generated: an image model asked to " +
      "draw a specific interface invents one, with plausible chrome and garbled text, " +
      "which is the last thing a picture whose job is to show the software should do.",
  },
  {
    file: "/marketing/social/presenter/shot-1-presenting.jpg",
    label: "First pass, laptop turned away",
    use: "Kept for comparison",
    prompt: PRESENTER_PROMPTS.shots[0].prompt,
    note:
      "The original generation. Same woman — she was used as the character reference " +
      "for the version above — but the screen faces away, so there is nothing to show.",
  },
];

export default function PresenterPreviewPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-10">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
          Temporary preview
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Presenter images</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
          Generated from the character brief in{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">social-kit.ts</code>. The
          character paragraph stays identical across every shot; only the scene sentence changes.
          That is what should keep her the same person from image to image.
        </p>
      </header>

      {SHOTS.map((shot) => (
        <figure key={shot.file} className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
            <Image
              src={shot.file}
              alt={shot.label}
              width={2000}
              height={1131}
              className="h-auto w-full"
              priority
            />
          </div>
          <figcaption className="flex flex-col gap-2">
            <p className="text-sm">
              <span className="font-medium">{shot.label}</span>
              <span className="text-stone-500"> — {shot.use}</span>
            </p>
            <p className="max-w-2xl text-xs leading-relaxed text-stone-600">{shot.note}</p>
            <details>
              <summary className="cursor-pointer select-none text-xs font-medium text-brand-700 hover:text-brand-600">
                The prompt behind it
              </summary>
              <div className="mt-2 flex flex-col gap-2 rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">
                <p>
                  <strong className="text-stone-800">Character (fixed):</strong>{" "}
                  {PRESENTER_PROMPTS.character}
                </p>
                <p>
                  <strong className="text-stone-800">Scene:</strong> {shot.prompt}
                </p>
              </div>
            </details>
          </figcaption>
        </figure>
      ))}

      <p className="border-t border-stone-100 pt-4 text-xs leading-relaxed text-stone-500">
        Nothing here is in use anywhere on the site. Delete this page and the files under
        <code className="mx-1 rounded bg-stone-100 px-1 py-0.5">
          public/marketing/social/presenter
        </code>
        once the set is settled.
      </p>
    </main>
  );
}
