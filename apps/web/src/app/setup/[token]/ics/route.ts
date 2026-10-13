import { inviteForToken } from "@/lib/setup-invites";
import { sessionIcs } from "@/lib/setup-sessions";

export const dynamic = "force-dynamic";

/** Calendar file for one booked session, authorised by the emailed link. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const id = new URL(req.url).searchParams.get("b");
  const invite = await inviteForToken(token);
  const booking = invite?.bookings.find((b) => b.id === id);
  if (!invite || !booking) return new Response("Not found", { status: 404 });
  return new Response(
    sessionIcs({ id: booking.id, startsAt: booking.startsAt, name: invite.name }),
    {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="freehold-setup-session.ics"',
      },
    },
  );
}
