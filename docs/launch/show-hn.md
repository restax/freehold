# Show HN draft

> **Before posting:** repo must be public, demo live, and the site's claims
> reconciled with reality (see "Marketing honesty items" in TODO.md). Post
> from your own HN account; first-person is Paul's voice.

**Title:**

Show HN: Freehold – open-source transaction management for real estate TCs

**URL:** https://github.com/restax/freehold

**Text:**

I've been a real estate broker for 30 years. Every closing is run by a
transaction coordinator (a TC) juggling 40+ deadlines across dozens of
deals, and the software they rent for the privilege is expensive,
per-seat-priced, and hostile to leaving. I got tired of watching it, so I
built the thing I always wanted — with heavy help from AI, since I'm not a
developer by trade.

Freehold is an Apache-2.0 transaction management + CRM platform for TCs and
small brokerages:

- The wedge feature: upload a purchase contract PDF and the AI extracts
  price, dates, deadlines, and parties — every value page-cited and quoted,
  confidence-scored, and nothing applies until a human confirms it. No
  guessing, because a wrong closing date is a lawsuit.
- Checklists ("action plans") that compute task deadlines from the contract
  and close dates.
- Client portals on capability links, a credential vault (AES-256-GCM
  envelope encryption) for the MLS/lockbox logins TCs inevitably hold,
  e-signatures through Documenso or DocuSign, CSV import, a REST API with
  signed webhooks, and client invoicing via Stripe.

Stack: Next.js + Fastify + Postgres in a pnpm monorepo. Tenant isolation is
Postgres row-level security — the app connects as a non-owner role so RLS
can't be silently bypassed (a mistake we caught live in development).

Self-hosting is free forever with every feature: `docker compose up` on any
box, including the dusty PC in your office closet. Revenue is Freehold
Cloud ($0 for 2 users / 10 transactions a month; Pro is a flat $29/month
for 2 users and 50 transactions; both paid plans fit 200 active clients) —
hosting convenience, not feature ransom. Your data exports in full either way, and
we don't pay commissions to people who recommend us — a common practice in
this niche that I think distorts every review you'll read about TC
software.

One honest policy that might interest HN: the feature list has an "on
request" tier. If you ask for something and it fits, it ships in days, not
weeks — if you need it, hundreds of other TCs probably do too. If we
disagree, we say so directly instead of stringing you along.

Live demo (shared, resets nightly): https://freeholdtc.dev/api/demo

I'd love feedback on the extraction UX and what would make you trust — or
distrust — AI reading contracts your license depends on.
