import { NextResponse } from "next/server";
import { checkUsernameAvailability } from "@/lib/username";

export const dynamic = "force-dynamic";

/**
 * Live username availability for the signup form: the field debounces to here
 * and renders a spinner → green check (available) or the reason (taken /
 * reserved / malformed). Public by design — it reveals only whether a handle is
 * free, the same thing a signup attempt would reveal.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("u") ?? "";
  if (!raw.trim()) {
    return NextResponse.json({ available: false, username: "", reason: "Enter a username." });
  }
  const result = await checkUsernameAvailability(raw);
  return NextResponse.json(result);
}
