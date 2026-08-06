"use client";

import { useEffect, useRef } from "react";

/** Hidden form field carrying the pixel's anonId, so a server action's Stripe checkout can pass it through to a server-side purchase track for dedup. */
export function OpinlyAnonIdField() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.value = window.opinly?.anonId ?? "";
  }, []);

  return <input ref={ref} type="hidden" name="anonId" />;
}
