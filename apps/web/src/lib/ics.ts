/**
 * Shared iCalendar (RFC 5545) builder for every subscribe-once feed Freehold
 * publishes: per-portal-link and per-user personal calendars alike. One
 * escaper, one VEVENT shape, so a fix to one feed's formatting fixes both.
 */

export interface IcsEvent {
  uid: string;
  date: Date;
  summary: string;
  /** iCal PRIORITY (1 = highest ... 9 = lowest); omit for normal-priority items. */
  priority?: 1 | 5;
}

export function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(events: IcsEvent[], calendarName: string): string {
  const day = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const stamp = `${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Freehold//calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@freeholdtc.dev`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day(e.date)}`,
      `SUMMARY:${escapeIcs(e.summary)}`,
    );
    if (e.priority) lines.push(`PRIORITY:${e.priority}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
