"use client";

import { Check, CircleNotch, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MIN_PASSWORD_SCORE, PasswordStrength } from "@/components/password-strength";
import { authClient } from "@/lib/auth-client";

type AvailState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok" }
  | { status: "bad"; reason: string };

const inputCls =
  "rounded-lg border border-stone-300 px-3 py-2 focus:border-brand-600 focus:outline-none";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [avail, setAvail] = useState<AvailState>({ status: "idle" });
  const [password, setPassword] = useState("");
  const [score, setScore] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Live availability: debounce, and cancel in-flight checks so the last
  // keystroke wins.
  useEffect(() => {
    if (!username) {
      setAvail({ status: "idle" });
      return;
    }
    setAvail({ status: "checking" });
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/username-available?u=${encodeURIComponent(username)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { available: boolean; reason?: string };
        setAvail(
          data.available
            ? { status: "ok" }
            : { status: "bad", reason: data.reason ?? "Unavailable." },
        );
      } catch {
        if (!controller.signal.aborted) setAvail({ status: "idle" });
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [username]);

  const passwordOk = password.length >= 8 && score >= MIN_PASSWORD_SCORE;
  const canSubmit =
    !busy &&
    name.trim() !== "" &&
    email.trim() !== "" &&
    avail.status === "ok" &&
    passwordOk &&
    agreed;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const { error } = await authClient.signUp.email({ name, email, username, password });
    if (error) {
      setError(error.message ?? "Sign-up failed.");
      setBusy(false);
      return;
    }
    // With email verification on (Cloud), sign-up doesn't create a session;
    // the 6-digit code page finishes the job. Self-host goes straight in.
    const { data: session } = await authClient.getSession();
    if (session?.user) {
      router.push("/onboarding");
    } else {
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Create your account</h1>
      <label className="flex flex-col gap-1 text-sm">
        Your name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Username
        <div className="relative">
          <input
            required
            value={username}
            // Usernames are subdomains: force lowercase and drop whitespace as
            // they type so the field only ever holds a legal-shaped handle.
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
            placeholder="yourname"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={`${inputCls} w-full pr-9 ${
              avail.status === "bad"
                ? "border-red-400"
                : avail.status === "ok"
                  ? "border-emerald-500"
                  : ""
            }`}
          />
          <span className="-translate-y-1/2 absolute top-1/2 right-3">
            {avail.status === "checking" && (
              <CircleNotch
                size={18}
                className="animate-spin text-stone-400"
                aria-label="Checking"
              />
            )}
            {avail.status === "ok" && (
              <Check size={18} weight="bold" className="text-emerald-600" aria-label="Available" />
            )}
            {avail.status === "bad" && (
              <X size={18} weight="bold" className="text-red-500" aria-label="Unavailable" />
            )}
          </span>
        </div>
        {avail.status === "bad" ? (
          <span className="text-xs text-red-600">{avail.reason}</span>
        ) : avail.status === "ok" ? (
          <span className="text-xs text-emerald-700">{username}.freeholdtc.dev is available</span>
        ) : (
          <span className="text-xs text-stone-400">
            Lowercase letters, numbers, and hyphens. This is your sign-in name and subdomain.
          </span>
        )}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </label>
      <PasswordStrength password={password} onScore={setScore} />
      <label className="flex items-start gap-2 text-xs text-stone-500">
        <input
          type="checkbox"
          required
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="underline hover:text-stone-600">
            terms of service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="underline hover:text-stone-600">
            privacy policy
          </Link>
          , including the security disclaimer, the limitation of liability, and that I'm solely
          responsible for my business's compliance with my state's real estate and licensing laws.
        </span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create account"}
      </button>
      <p className="text-center text-xs text-stone-400">
        Freehold is source-available. If Freehold Cloud ever shuts down, you can self-host the same
        app from{" "}
        <a
          href="https://github.com/restax/freehold"
          className="underline hover:text-stone-600"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>{" "}
        and keep your data, your business is never locked in.
      </p>
      <p className="text-center text-sm text-stone-500">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
