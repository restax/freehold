"use client";

import Image, { type StaticImageData } from "next/image";
import { useRef } from "react";

/**
 * A real product screenshot, framed so it reads as one: a slim window bar,
 * a hairline border, and a soft shadow. Clicking opens the full-size capture
 * in a native <dialog> lightbox, so close-ups can stay small on the page
 * without anyone squinting.
 *
 * These are actual captures of the product with sample data, not mockups;
 * the framing is the only decoration.
 */
export function ScreenshotFigure({
  src,
  alt,
  caption,
  className = "",
  crop = false,
  position = "left top",
}: {
  src: StaticImageData;
  alt: string;
  caption: string;
  className?: string;
  /** Uniform-tile mode: fixed-height frame, image cropped to fill. Keeps a
   *  gallery of mixed aspect ratios on one clean grid; the lightbox still
   *  shows the whole capture. */
  crop?: boolean;
  /** Which part of the capture survives the crop, e.g. "left top". */
  position?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <figure className={className}>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`Enlarge screenshot: ${caption}`}
        className="group block w-full cursor-zoom-in overflow-hidden rounded-xl border border-stone-200 bg-white text-left shadow-[0_1px_2px_rgba(28,25,23,0.06),0_12px_32px_-16px_rgba(28,25,23,0.25)] transition hover:shadow-[0_1px_2px_rgba(28,25,23,0.06),0_16px_40px_-16px_rgba(28,25,23,0.35)]"
      >
        <span
          aria-hidden
          className="flex items-center gap-1.5 border-b border-stone-100 bg-stone-50 px-3 py-2"
        >
          <span className="h-2 w-2 rounded-full bg-stone-300" />
          <span className="h-2 w-2 rounded-full bg-stone-300" />
          <span className="h-2 w-2 rounded-full bg-stone-300" />
        </span>
        {crop ? (
          <span className="relative block h-56">
            <Image
              src={src}
              alt={alt}
              fill
              style={{ objectFit: "cover", objectPosition: position }}
              className="transition-transform duration-300 group-hover:scale-[1.015]"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          </span>
        ) : (
          <Image
            src={src}
            alt={alt}
            className="w-full transition-transform duration-300 group-hover:scale-[1.015]"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        )}
      </button>
      <figcaption className="mt-2 text-sm leading-snug text-stone-500">{caption}</figcaption>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: <dialog> closes on
          Escape natively; the click handler only adds backdrop-click close. */}
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          // Click on the backdrop (the dialog element itself) closes it.
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-auto max-h-[92vh] w-[min(1100px,94vw)] rounded-2xl bg-transparent p-0 backdrop:bg-stone-950/70"
      >
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-2.5">
            <p className="text-sm text-stone-600">{caption}</p>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded px-2 py-0.5 text-sm text-stone-500 transition hover:bg-stone-200/60 hover:text-stone-800"
            >
              Close
            </button>
          </div>
          <Image src={src} alt={alt} className="h-auto w-full" sizes="94vw" />
        </div>
      </dialog>
    </figure>
  );
}
