import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEMO_EMAIL, demoEnabled, ensureDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

/** Signs the visitor into the shared demo workspace and lands them on the dashboard. */
export async function GET(req: Request) {
  if (!demoEnabled()) {
    return NextResponse.json({ error: "Demo is not enabled on this install" }, { status: 404 });
  }
  await ensureDemo();

  const signIn = await auth.api.signInEmail({
    body: { email: DEMO_EMAIL, password: process.env.DEMO_USER_PASSWORD as string },
    asResponse: true,
  });
  if (!signIn.ok) {
    return NextResponse.json({ error: "Demo sign-in failed" }, { status: 500 });
  }

  const redirect = NextResponse.redirect(new URL("/dashboard", req.url), 303);
  for (const cookie of signIn.headers.getSetCookie()) {
    redirect.headers.append("set-cookie", cookie);
  }
  return redirect;
}
