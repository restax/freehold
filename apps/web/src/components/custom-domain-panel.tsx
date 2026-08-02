"use client";

import { ArrowClockwise, CheckCircle, Clock, Copy } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  checkCustomDomain,
  connectCustomDomain,
  disconnectCustomDomain,
} from "@/lib/actions/website";
import { dnsRecordFor } from "@/lib/domains";
import { btn, btnGhost, input, label as labelCls } from "@/lib/ui";

/**
 * Connect a domain the workspace owns.
 *
 * The shape of this follows what the TC actually has to do, which is one thing
 * at their registrar: add a record. So the panel is a record to copy and a
 * button to re-check — not a wizard. Nothing here polls; DNS can take an hour
 * and a spinner running that long is worse than a button that says "Check
 * again".
 */
export function CustomDomainPanel({
  domain,
  status,
  note,
  apexName,
  subdomainUrl,
}: {
  domain: string | null;
  status: string | null;
  note: string | null;
  apexName: string | null;
  /** Always keeps working, which is worth saying while DNS is propagating. */
  subdomainUrl: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const active = status === "active";
  const record = domain ? dnsRecordFor(domain, apexName) : null;

  function run(fn: () => Promise<{ ok: true } | { error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn().catch(() => ({ error: "Something went wrong. Try again." }));
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  }

  if (!domain) {
    return (
      <form action={(fd) => run(() => connectCustomDomain(fd))} className="flex flex-col gap-3">
        <p className="text-sm text-stone-500">
          Your site is always at{" "}
          <span className="font-medium text-stone-700">
            {subdomainUrl.replace(/^https?:\/\//, "")}
          </span>
          . If you own a domain, you can serve the same site from it — you'll add one record at
          whoever you bought it from.
        </p>
        <label className={labelCls}>
          Your domain
          <input name="domain" placeholder="www.yourbusiness.com" className={input} />
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={btn}>
            {pending ? "Connecting…" : "Connect domain"}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-stone-800">{domain}</span>
        {active ? (
          <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
            <CheckCircle size={13} weight="fill" aria-hidden />
            Live
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            <Clock size={13} weight="fill" aria-hidden />
            Waiting on DNS
          </span>
        )}
      </div>

      {!active && record && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm text-stone-600">
            Add this record wherever you bought {domain}, then check again. Until it's live your
            site stays at{" "}
            <a
              href={subdomainUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-700 hover:underline"
            >
              {subdomainUrl.replace(/^https?:\/\//, "")}
            </a>
            .
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 text-sm">
            <dt className="text-stone-500">Type</dt>
            <dd className="font-mono text-stone-800">{record.type}</dd>
            <dt className="text-stone-500">Name</dt>
            <dd className="font-mono text-stone-800">{record.name}</dd>
            <dt className="text-stone-500">Value</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono text-stone-800">{record.value}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(record.value);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="text-stone-400 hover:text-stone-700"
                aria-label="Copy the record value"
              >
                <Copy size={14} />
              </button>
              {copied && <span className="text-xs text-stone-400">Copied</span>}
            </dd>
          </dl>
          {note && <p className="mt-3 text-xs text-amber-800">{note}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => run(checkCustomDomain)}
          disabled={pending}
          className={btnGhost}
        >
          <ArrowClockwise size={13} className="mr-1 inline" aria-hidden />
          {pending ? "Checking…" : "Check again"}
        </button>
        <button
          type="button"
          onClick={() => run(disconnectCustomDomain)}
          disabled={pending}
          className="text-sm text-red-700 transition-colors hover:text-red-900"
        >
          Disconnect
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
