import { prisma } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AcceptInvitationButton } from "@/components/accept-invitation";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = await params;
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { organization: { select: { name: true } } },
  });
  if (!invitation || invitation.status !== "pending" || invitation.expiresAt < new Date()) {
    notFound();
  }
  const session = await getSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Join {invitation.organization.name}</h1>
        <p className="mt-2 text-sm text-stone-500">
          You've been invited to join <strong>{invitation.organization.name}</strong> on Freehold as{" "}
          <strong>{invitation.role ?? "member"}</strong>, using <strong>{invitation.email}</strong>.
        </p>
        <div className="mt-5">
          {session ? (
            session.user.email.toLowerCase() === invitation.email.toLowerCase() ? (
              <AcceptInvitationButton invitationId={invitation.id} />
            ) : (
              <p className="text-sm text-red-600">
                You're signed in as {session.user.email}, but this invitation is for{" "}
                {invitation.email}. Sign out and sign in with the invited email.
              </p>
            )
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-stone-600">
                Sign up (or sign in) with <strong>{invitation.email}</strong>, then return to this
                link.
              </p>
              <div className="flex justify-center gap-3">
                <Link
                  href="/signup"
                  className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
                >
                  Create account
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg border border-stone-300 bg-white px-4 py-2 font-medium text-stone-700 hover:bg-stone-100"
                >
                  Sign in
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
