# r/selfhosted draft

> **Before posting:** repo public, demo live. r/selfhosted is allergic to
> marketing — keep it factual, lead with the compose file, disclose the
> cloud offering plainly. Flair: "Release". Also suitable (lightly edited)
> for r/opensource and r/realtors.

**Title:**

Freehold – source-available transaction management for real estate
transaction coordinators (free self-host, docker compose, AGPL-free)

**Body:**

I've spent 30 years in real estate brokerage and finally built the tool the
industry rents at $30–60/user/month: transaction management + CRM for the
coordinators who run closings. Sharing here because self-hosting is the
first-class path, not a crippled community edition.

**What it does:** transaction pipeline with deadline-computing checklists,
contacts/clients CRM, client portals on revocable links, document storage,
e-signatures (bundled open-source Documenso), an encrypted credential
vault with access auditing, CSV import, REST API + HMAC-signed webhooks,
and optional AI contract extraction (reads the purchase contract PDF,
page-cites every extracted date and dollar for human confirmation).

**Self-hosting facts, since that's why we're here:**

- `git clone`, `cp .env.example .env`, set two secrets, `docker compose up
  -d`. Postgres, Redis, MinIO, migrations, web on :3000, API on :3001.
- Runs comfortably in 4 GB RAM, works in 2 — an unused office PC is a
  perfectly good production box for a solo TC.
- Every feature, no seat limits, no license keys, forever. License is the
  Elastic License 2.0: self-host and modify freely for your own
  organization; what you can't do is resell it or run it as a hosted
  service for others. Saying it plainly up front: this is source-available,
  not OSI open source — the trade is that the project stays funded.
  (One clearly-marked `ee/` billing directory is separately commercial.)
- Bring your own keys where it makes sense: Anthropic for the AI (a few
  cents per contract, optional), your own Stripe for invoicing clients,
  any S3-compatible storage.
- Backups are `pg_dump` plus one MinIO directory. Restore documented.
- HTTPS via whatever you already use; Caddy config in the docs.

**The disclosure:** I fund this with a hosted version (free tier, then a
flat $40/month, 7-day free trial). Nothing self-hosted phones home, nothing is gated, and the
moving-away path (full export) is documented. We also don't run an
affiliate program — common in this niche, and in my opinion the reason its
software reviews are worthless.

Repo: https://github.com/restax/freehold
Self-hosting guide: https://github.com/restax/freehold/blob/main/docs/SELF-HOSTING.md
Live demo (shared, resets nightly): https://freeholdtc.dev/api/demo

Happy to answer anything about the stack (Next.js, Fastify, Postgres RLS
for tenant isolation) or the industry it serves.
