/**
 * Setup sessions: the free 30 minute onboarding calls offered to new accounts.
 * Pure helpers only (slot rules, time zone maths, the offer email, the calendar
 * file) so the rules are tested in one place and the pages and actions stay thin.
 */

export const SESSION_MINUTES = 30;
export const MAX_SESSIONS = 6;
export const SLOT_TZ = "America/New_York";
/** Days of the week offered (0 = Sunday): Tuesday, Wednesday, Thursday. */
export const SLOT_WEEKDAYS = [2, 3, 4];
/** Start times offered each of those days, Eastern: 7:00 AM, 10:00 AM, 1:00 PM, 7:00 PM. */
export const SLOT_TIMES: Array<[number, number]> = [
  [7, 0],
  [10, 0],
  [13, 0],
  [19, 0],
];
const LEAD_HOURS = 36;
const WINDOW_DAYS = 16;

interface WallTime {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
}

function wallInSlotTz(ms: number): WallTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SLOT_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: n("year"), m: n("month"), d: n("day"), h: n("hour"), min: n("minute") };
}

/** The instant at which the Eastern wall clock reads this date and time. */
export function slotTimeToDate(y: number, m: number, d: number, h: number, min: number): Date {
  const target = Date.UTC(y, m - 1, d, h, min);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const w = wallInSlotTz(guess);
    guess -= Date.UTC(w.y, w.m - 1, w.d, w.h, w.min) - target;
  }
  return new Date(guess);
}

/** Every bookable start time from `now`, soonest first. */
export function offeredSlots(now: Date = new Date()): Date[] {
  const today = wallInSlotTz(now.getTime());
  const earliest = now.getTime() + LEAD_HOURS * 3600 * 1000;
  const out: Date[] = [];
  for (let i = 0; i <= WINDOW_DAYS; i++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    if (!SLOT_WEEKDAYS.includes(day.getUTCDay())) continue;
    for (const [h, min] of SLOT_TIMES) {
      const start = slotTimeToDate(
        day.getUTCFullYear(),
        day.getUTCMonth() + 1,
        day.getUTCDate(),
        h,
        min,
      );
      if (start.getTime() >= earliest) out.push(start);
    }
  }
  return out;
}

export function isOfferedSlot(at: Date, now: Date = new Date()): boolean {
  return offeredSlots(now).some((s) => s.getTime() === at.getTime());
}

export function slotDayLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SLOT_TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function slotTimeLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SLOT_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function slotFullLabel(d: Date): string {
  return `${slotDayLabel(d)} at ${slotTimeLabel(d)} Eastern`;
}

/** Slots grouped by day, in order, for rendering. */
export function groupByDay(slots: Date[]): Array<{ label: string; slots: Date[] }> {
  const groups: Array<{ label: string; slots: Date[] }> = [];
  for (const s of slots) {
    const label = slotDayLabel(s);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.slots.push(s);
    else groups.push({ label, slots: [s] });
  }
  return groups;
}

/** A timed calendar file for one session. */
export function sessionIcs(input: { id: string; startsAt: Date; name: string }): string {
  const stamp = (d: Date) => `${d.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const end = new Date(input.startsAt.getTime() + SESSION_MINUTES * 60 * 1000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Freehold//setup//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:setup-${input.id}@freeholdtc.dev`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(input.startsAt)}`,
    `DTEND:${stamp(end)}`,
    "SUMMARY:Freehold setup session",
    "DESCRIPTION:Your 30 minute Freehold setup session. We will send the call details ahead of time.",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
// Earth tones: umber header, clay accent, sand page.
const C = {
  page: "#f4efe6",
  header: "#7d5c3e",
  headerSoft: "#e6d8c4",
  accent: "#9a5f33",
  ink: "#33291f",
  muted: "#6f6252",
  rule: "#e3d9c8",
  chipBg: "#faf6ee",
  chipBorder: "#d3c3a8",
  chipText: "#6b4a2b",
};

const FEATURES: Array<[string, string]> = [
  [
    "Email templates",
    "Write the messages you send over and over once, then send them from any file in a click.",
  ],
  [
    "To-do lists",
    "Build the checklist you follow on every transaction so nothing depends on memory.",
  ],
  [
    "Getting your clients on board",
    "Show your clients and agents how to follow their own file, so the status calls answer themselves.",
  ],
  [
    "The built in AI features",
    "We will show you how they work and where they help. If you would rather not use them, we will switch them off for you.",
  ],
  [
    "Made to fit you",
    "If something does not match the way you work, tell us. Freehold is built in house, so we can usually make the change quickly.",
  ],
];

export function setupOfferEmail(input: { name: string; pageUrl: string; slots: Date[] }): {
  subject: string;
  text: string;
  html: string;
} {
  const first = input.name.trim().split(/\s+/)[0] || "there";
  const days = groupByDay(input.slots).slice(0, 3);
  const link = (s: Date) => `${input.pageUrl}?at=${encodeURIComponent(s.toISOString())}`;
  const intro =
    "You signed up for Freehold, and we would like to make sure it works the way you do. We are offering six free 30 minute sessions, one on one, to get you up and running. Pick a time below and it goes straight onto the calendar.";
  const closing =
    "Use the six sessions all at once or spread them over a few weeks. Bring a file you are working on, or just bring your questions. You do not need to sign in to book.";

  const text = [
    `Hi ${first},`,
    "",
    intro,
    "",
    "Pick a time (all times Eastern):",
    "",
    ...days.flatMap((g) => [
      g.label,
      ...g.slots.map((s) => `  ${slotTimeLabel(s)}: ${link(s)}`),
      "",
    ]),
    `More times: ${input.pageUrl}`,
    "",
    "You can also call or text us at 774-240-4715 to set up a time.",
    "",
    "What we can do in the sessions:",
    "",
    ...FEATURES.map(([t, d], i) => `${i + 1}. ${t}. ${d}`),
    "",
    closing,
    "",
    "We look forward to working with you.",
    "",
    "Paul Slazas",
    "Founder, Freehold",
    "774-240-4715 | paul.slazas@freeholdtc.dev",
  ].join("\n");

  const chip = (s: Date) =>
    `<a href="${esc(link(s))}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border:1px solid ${C.chipBorder};border-radius:4px;background:${C.chipBg};font-family:${SANS};font-size:15px;font-weight:600;color:${C.chipText};text-decoration:none;">${esc(slotTimeLabel(s))}</a>`;
  const dayRows = days
    .map(
      (g) =>
        `<tr><td style="padding:0 0 6px 0;font-family:${SANS};font-size:14px;color:${C.muted};text-transform:uppercase;letter-spacing:1px;">${esc(g.label)}</td></tr><tr><td style="padding:0 0 12px 0;">${g.slots.map(chip).join("")}</td></tr>`,
    )
    .join("");
  const featureRows = FEATURES.map(
    ([t, d], i) =>
      `<tr><td width="28" valign="top" style="padding:0 0 14px 0;color:${C.accent};font-weight:700;">${i + 1}</td><td style="padding:0 0 14px 0;"><strong>${esc(t)}.</strong> ${esc(d)}</td></tr>`,
  ).join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Let's get you set up</title></head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;color:${C.page};">Six free 30 minute sessions. Pick a time and it goes on the calendar.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:6px;overflow:hidden;">
<tr><td style="background:${C.header};padding:26px 36px 24px 36px;">
<div style="font-family:${SERIF};font-size:15px;letter-spacing:2px;text-transform:uppercase;color:${C.headerSoft};">Freehold</div>
<div style="font-family:${SERIF};font-size:30px;line-height:1.2;color:#ffffff;padding-top:14px;">Let's get you set up.</div>
</td></tr>
<tr><td style="padding:32px 36px 8px 36px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">
<p style="margin:0 0 16px 0;">Hi ${esc(first)},</p>
<p style="margin:0 0 8px 0;">${esc(intro)}</p>
</td></tr>
<tr><td style="padding:16px 36px 4px 36px;font-family:${SERIF};font-size:21px;color:${C.accent};">Pick a time</td></tr>
<tr><td style="padding:4px 36px 0 36px;font-family:${SANS};font-size:13px;color:${C.muted};">All times Eastern. One click and you are booked.</td></tr>
<tr><td style="padding:14px 36px 0 36px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${dayRows}</table></td></tr>
<tr><td style="padding:0 36px 24px 36px;font-family:${SANS};font-size:15px;"><a href="${esc(input.pageUrl)}" style="color:${C.accent};">See more times</a><div style="padding-top:10px;color:${C.ink};">You can also call or text us at <a href="tel:+17742404715" style="color:${C.accent};">774-240-4715</a> to set up a time.</div></td></tr>
<tr><td style="padding:0 36px;"><div style="border-top:1px solid ${C.rule};"></div></td></tr>
<tr><td style="padding:26px 36px 4px 36px;font-family:${SERIF};font-size:21px;color:${C.accent};">What we can do in the sessions</td></tr>
<tr><td style="padding:12px 36px 8px 36px;font-family:${SANS};font-size:16px;line-height:1.55;color:${C.ink};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${featureRows}</table></td></tr>
<tr><td style="padding:8px 36px 8px 36px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">
<p style="margin:0 0 16px 0;">${esc(closing)}</p>
<p style="margin:0 0 4px 0;">We look forward to working with you.</p>
</td></tr>
<tr><td style="padding:12px 36px 34px 36px;font-family:${SANS};font-size:15px;line-height:1.5;color:${C.ink};">
<div style="font-weight:600;">Paul Slazas</div>
<div style="color:${C.muted};">Founder, Freehold</div>
<div style="color:${C.muted};">774-240-4715 | paul.slazas@freeholdtc.dev</div>
</td></tr>
</table>
<div style="font-family:${SANS};font-size:12px;color:${C.muted};padding:16px 12px;">You are receiving this because you created a Freehold account.</div>
</td></tr></table></body></html>`;

  return { subject: "Let's get your Freehold account set up", text, html };
}
