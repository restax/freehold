import Link from "next/link";

/* Shared brand chrome: wordmark, nav, footer, and the extraction review card. */

export function Wordmark({ href = "/", size = "md" }: { href?: string; size?: "sm" | "md" }) {
  const mark =
    size === "sm"
      ? "grid h-7 w-7 place-items-center rounded-lg bg-brand-700 font-display text-sm font-extrabold text-white"
      : "grid h-8 w-8 place-items-center rounded-lg bg-brand-700 font-display text-base font-extrabold text-white";
  const text =
    size === "sm"
      ? "font-display text-base font-bold tracking-tight text-stone-900"
      : "font-display text-lg font-bold tracking-tight text-stone-900";
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span className={mark}>F</span>
      <span className={text}>Freehold</span>
    </Link>
  );
}

export function MarketingNav() {
  return (
    <header className="border-b border-stone-200/70 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Wordmark />
        <nav className="hidden items-center gap-7 text-sm text-stone-600 sm:flex">
          <Link href="/features" className="transition-colors hover:text-stone-900">
            Features
          </Link>
          <Link href="/integrations" className="transition-colors hover:text-stone-900">
            Integrations
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-stone-900">
            Pricing
          </Link>
          <Link href="/compare" className="transition-colors hover:text-stone-900">
            Open source
          </Link>
        </nav>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/login" className="text-stone-600 transition-colors hover:text-stone-900">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-brand-600 px-4 py-2 font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-stone-200/70 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Wordmark size="sm" />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-stone-500">
            The open-source, all-in-one platform for real estate transaction management and CRM.
          </p>
        </div>
        <nav aria-label="Product">
          <h3 className="text-sm font-medium">Product</h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-stone-500">
            <li>
              <Link href="/features" className="transition-colors hover:text-stone-900">
                Features
              </Link>
            </li>
            <li>
              <Link href="/integrations" className="transition-colors hover:text-stone-900">
                Integrations
              </Link>
            </li>
            <li>
              <Link href="/#extraction" className="transition-colors hover:text-stone-900">
                Contract extraction
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="transition-colors hover:text-stone-900">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/docs/api" className="transition-colors hover:text-stone-900">
                API reference
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Open source">
          <h3 className="text-sm font-medium">Open source</h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-stone-500">
            <li>
              <a
                href="https://github.com/restax/freehold/blob/main/docs/SELF-HOSTING.md"
                className="transition-colors hover:text-stone-900"
              >
                Self-hosting
              </a>
            </li>
            <li>
              <Link href="/compare" className="transition-colors hover:text-stone-900">
                Cloud vs self-host
              </Link>
            </li>
            <li>
              <a
                href="https://github.com/restax/freehold/blob/main/LICENSE"
                className="transition-colors hover:text-stone-900"
              >
                License
              </a>
            </li>
          </ul>
        </nav>
        <nav aria-label="For partners">
          <h3 className="text-sm font-medium">For partners</h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-stone-500">
            <li>
              <Link href="/#partners" className="transition-colors hover:text-stone-900">
                IT providers
              </Link>
            </li>
            <li>
              <Link href="/signup" className="transition-colors hover:text-stone-900">
                Create an account
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="transition-colors hover:text-stone-900">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="transition-colors hover:text-stone-900">
                Terms
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-stone-100">
        <p className="mx-auto max-w-6xl px-4 py-5 text-center text-sm text-stone-400 sm:px-6">
          Freehold is open source under Apache-2.0. Self-hosting is free forever.
        </p>
      </div>
    </footer>
  );
}

export function ExtractionReviewCard() {
  const rows: Array<[string, string, string, "high" | "medium"]> = [
    ["Purchase price", "$412,500", "cited p. 1, §2(a)", "high"],
    ["Effective date", "Mar 14, 2026", "cited p. 1, §1", "high"],
    ["Inspection deadline", "Mar 24, 2026", "cited p. 4, §7(b)", "medium"],
    ["Financing deadline", "Apr 3, 2026", "cited p. 5, §8(a)", "high"],
    ["Closing date", "Apr 28, 2026", "cited p. 9, §14", "high"],
  ];
  const chip = {
    high: "bg-brand-50 text-brand-700",
    medium: "bg-amber-50 text-amber-700",
  } as const;
  return (
    <div className="w-full max-w-xl rounded-2xl border border-stone-200/70 bg-white p-6 shadow-[0_1px_2px_rgb(41_37_36/0.05),0_16px_40px_rgb(41_37_36/0.1)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">Review extraction</p>
        <span className="rounded-full bg-brand-50 px-3 py-1 font-mono text-xs text-brand-700">
          purchase-contract.pdf
        </span>
      </div>
      <ul className="mt-4 flex flex-col">
        {rows.map(([label, value, cite, conf]) => (
          <li
            key={label}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-stone-100 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{label}</p>
              <p className="mt-0.5 text-xs text-stone-400">{cite}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-sm">{value}</span>
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${chip[conf]}`}>
                {conf}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5">
        <span className="text-sm text-stone-500">4 confirmed, 1 flagged for review</span>
        <span className="text-sm font-medium text-brand-700">Apply to transaction</span>
      </div>
    </div>
  );
}
