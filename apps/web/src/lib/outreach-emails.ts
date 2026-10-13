/**
 * The operator's numbered email series. Email 1 is live; the rest are empty
 * slots to fill as each is designed. To add one: give its slot a title and
 * status "live", write its builder next to lib/setup-sessions.ts, and send it
 * through lib/outreach-send.ts so the once-per-person rule applies.
 */
export interface OutreachEmail {
  key: string;
  number: number;
  title: string;
  status: "live" | "placeholder";
}

export const OUTREACH_EMAILS: OutreachEmail[] = [
  { key: "setup-offer", number: 1, title: "Setup sessions offer", status: "live" },
  ...Array.from({ length: 10 }, (_, i) => ({
    key: `email-${i + 2}`,
    number: i + 2,
    title: "Not designed yet",
    status: "placeholder" as const,
  })),
];

export const SETUP_OFFER_KEY = "setup-offer";
