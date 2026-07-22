"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A password strength meter backed by zxcvbn (score 0–4). The library and its
 * dictionaries are heavy, so they're dynamically imported on first use — the
 * signup page stays light until someone actually types a password.
 */

type Zxcvbn = (pw: string) => { score: number };
let zxcvbnFn: Zxcvbn | null = null;
let loader: Promise<void> | null = null;

async function loadZxcvbn(): Promise<void> {
  if (zxcvbnFn) return;
  if (!loader) {
    loader = (async () => {
      const [core, common, en] = await Promise.all([
        import("@zxcvbn-ts/core"),
        import("@zxcvbn-ts/language-common"),
        import("@zxcvbn-ts/language-en"),
      ]);
      const factory = new core.ZxcvbnFactory({
        dictionary: { ...common.dictionary, ...en.dictionary },
        graphs: common.adjacencyGraphs,
        translations: en.translations,
      });
      zxcvbnFn = (pw: string) => factory.check(pw);
    })();
  }
  await loader;
}

const LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const BAR_COLORS = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-lime-500", "bg-emerald-600"];

/** The minimum zxcvbn score we accept ("medium"). */
export const MIN_PASSWORD_SCORE = 2;

export function PasswordStrength({
  password,
  onScore,
}: {
  password: string;
  onScore: (score: number) => void;
}) {
  const [score, setScore] = useState(0);
  // Keep the latest callback without making it an effect dependency.
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;

  useEffect(() => {
    if (!password) {
      setScore(0);
      onScoreRef.current(0);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      await loadZxcvbn();
      if (!active || !zxcvbnFn) return;
      const s = zxcvbnFn(password).score;
      setScore(s);
      onScoreRef.current(s);
    }, 150);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [password]);

  if (!password) return null;
  const ok = score >= MIN_PASSWORD_SCORE;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= score ? BAR_COLORS[score] : "bg-stone-200"}`}
          />
        ))}
      </div>
      <p className={`text-xs ${ok ? "text-emerald-700" : "text-stone-500"}`}>
        {LABELS[score]}
        {!ok && " — use a longer or less common password"}
      </p>
    </div>
  );
}
