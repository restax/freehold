/**
 * The stable half of Next.js's generated `next-env.d.ts`, committed.
 *
 * `next-env.d.ts` itself is gitignored: Next rewrites it on every run,
 * pointing its last line at `.next/dev/types` or `.next/types` depending on
 * whether dev or build went last, so it showed up as a phantom diff in most
 * commits.
 *
 * But it isn't decorative — these two references are what let TypeScript
 * accept `import hero from "../../public/marketing/moving-day.jpg"`. Without
 * them `tsc --noEmit` fails with "cannot find module '*.jpg'" on the
 * marketing pages. Since the type-check is the first gate and can run on a
 * clone that has never built, relying on Next to have regenerated the file
 * would make that gate depend on what someone happened to run before it.
 *
 * These lines never change, so committing them costs nothing and keeps the
 * type-check self-sufficient. The generated file still appears locally and
 * still carries the volatile route-types import; nothing here conflicts with
 * it — duplicate `/// <reference>` directives are idempotent.
 */

/// <reference types="next" />
/// <reference types="next/image-types/global" />
