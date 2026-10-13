import { prisma } from "@freehold/db";
import { Wordmark } from "@/components/marketing";
import { bookSetupSession, cancelSetupSession } from "@/lib/actions/setup-sessions";
import { inviteForToken } from "@/lib/setup-invites";
import {
  groupByDay,
  isOfferedSlot,
  MAX_SESSIONS,
  offeredSlots,
  slotFullLabel,
  slotTimeLabel,
} from "@/lib/setup-sessions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book a setup session", robots: { index: false } };

const NOTE: Record<string, string> = {
  booked: "You are booked. A confirmation with a calendar file is on its way to your inbox.",
  taken: "Someone just took that time. Please pick another.",
  limit: `You have used all ${MAX_SESSIONS} of your sessions.`,
  unavailable: "That time is no longer available. Please pick another.",
  cancelled: "That session has been cancelled.",
};

const chip =
  "inline-block rounded border border-[#d3c3a8] bg-[#faf6ee] px-4 py-2 text-sm font-semibold text-[#6b4a2b] hover:bg-[#f1e8d7]";

/**
 * Public booking page for the setup-session offer. The long random link in the
 * email is the only credential, so a person books without signing in. A time
 * arriving from the email (?at=) lands on a confirm button rather than booking
 * on load, because mail scanners open links before the person does.
 */
export default async function SetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ at?: string; r?: string }>;
}) {
  const { token } = await params;
  const { at, r } = await searchParams;
  const invite = await inviteForToken(token);

  const shell = (children: React.ReactNode) => (
    <main className="flex min-h-screen flex-col items-center bg-[#f4efe6] px-6 py-10">
      <div className="mb-6">
        <Wordmark />
      </div>
      <div className="w-full max-w-xl rounded-xl border border-[#e3d9c8] bg-white p-6 shadow-sm">
        {children}
      </div>
    </main>
  );

  if (!invite) {
    return shell(
      <>
        <h1 className="text-lg font-semibold">This link is no longer active</h1>
        <p className="mt-2 text-sm text-stone-600">
          We may have sent you a newer one. Reply to the email and we will book a time with you.
        </p>
      </>,
    );
  }

  const taken = new Set(
    (await prisma.setupBooking.findMany({ select: { startsAt: true } })).map((b) =>
      b.startsAt.getTime(),
    ),
  );
  const open = offeredSlots().filter((s) => !taken.has(s.getTime()));
  const picked = at ? new Date(at) : null;
  const pickedOk =
    picked !== null &&
    !Number.isNaN(picked.getTime()) &&
    isOfferedSlot(picked) &&
    !taken.has(picked.getTime());
  const upcoming = invite.bookings.filter((b) => b.startsAt.getTime() > Date.now());
  const left = MAX_SESSIONS - invite.bookings.length;
  const first = invite.name.split(/\s+/)[0];
  const confirming = pickedOk && picked !== null && left > 0;

  return shell(
    <div className="flex flex-col gap-5">
      <div>
        {confirming ? (
          <>
            <h1 className="text-xl font-semibold">One more step, {first}</h1>
            <p className="mt-1 text-sm text-stone-600">
              Your time is <strong>not booked yet</strong>. Tap the button below to lock it in.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Hi {first}, pick a time</h1>
            <p className="mt-1 text-sm text-stone-600">
              Thirty minutes, free, one on one. You have {left} of {MAX_SESSIONS} sessions left. All
              times are Eastern.
            </p>
          </>
        )}
      </div>

      {r && NOTE[r] && (
        <p className="rounded bg-[#f4efe6] px-3 py-2 text-sm text-[#6b4a2b]">{NOTE[r]}</p>
      )}

      {confirming && picked && (
        <form
          action={bookSetupSession}
          className="flex flex-col gap-4 rounded-lg border-2 border-[#9a5f33] bg-[#faf6ee] p-5"
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="at" value={picked.toISOString()} />
          <p className="text-lg font-semibold text-[#33291f]">{slotFullLabel(picked)}</p>
          <button
            type="submit"
            className="w-full rounded-lg bg-[#9a5f33] px-5 py-3.5 text-base font-semibold text-white hover:bg-[#85502a]"
          >
            Confirm this time
          </button>
          <a
            href={`/setup/${encodeURIComponent(token)}`}
            className="text-center text-sm text-stone-500 hover:underline"
          >
            Choose a different time
          </a>
        </form>
      )}

      {upcoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-stone-700">Your booked sessions</h2>
          {upcoming.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#e3d9c8] px-3 py-2 text-sm"
            >
              <span>{slotFullLabel(b.startsAt)}</span>
              <span className="flex gap-3">
                <a
                  href={`/setup/${encodeURIComponent(token)}/ics?b=${b.id}`}
                  className="text-[#9a5f33] hover:underline"
                >
                  Add to calendar
                </a>
                <form action={cancelSetupSession}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="bookingId" value={b.id} />
                  <button type="submit" className="text-stone-500 hover:underline">
                    Cancel
                  </button>
                </form>
              </span>
            </div>
          ))}
        </div>
      )}

      {left > 0 && !confirming && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-stone-700">Available times</h2>
          {open.length === 0 && (
            <p className="text-sm text-stone-600">
              Nothing is open right now. Reply to our email and we will find a time.
            </p>
          )}
          {groupByDay(open).map((g) => (
            <div key={g.label}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-500">
                {g.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {g.slots.map((s) => (
                  <a
                    key={s.toISOString()}
                    href={`/setup/${encodeURIComponent(token)}?at=${encodeURIComponent(s.toISOString())}`}
                    className={chip}
                  >
                    {slotTimeLabel(s)}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>,
  );
}
