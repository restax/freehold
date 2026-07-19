# Freehold

Live at [freeholdtc.dev](https://freeholdtc.dev).

An AI-enabled real estate transaction management and CRM platform for brokerages and transaction coordinators — one system of record for listings, contracts, contacts, and closings. **Source-available (Elastic License 2.0): the full code is public, and self-hosting for your own organization is free and unlimited, forever — no license keys, no caps. What the license forbids is redistribution of the product and offering Freehold to others as a hosted or managed service, under any brand. Hosting for clients is what Freehold Cloud is for.** Revenue comes from Freehold Cloud (the hosted version), setup/migration services, and a template marketplace — not from restricting this repo.

The flagship AI feature: upload a purchase contract and Freehold extracts every key date and figure — page-cited, confidence-scored, human-confirmed before anything enters the record. No guessing.

See [`docs/PLAN.md`](docs/PLAN.md) for the full architecture and roadmap (or [`docs/plan.html`](docs/plan.html) — same content, styled; open it in a browser).

**Status:** live in beta — Freehold Cloud runs at [freeholdtc.dev](https://freeholdtc.dev), and the full stack self-hosts from one Docker Compose file.

What's in today:

- **Transactions & CRM** — transactions with unlimited custom fields, contacts, clients, parties, tasks, and action plans whose template tasks anchor to contract/close dates and auto-compute deadlines; pipeline dashboard, removable sample data, onboarding wizard. Multi-tenant with enforced Postgres row-level security.
- **AI contract extraction** — upload a purchase contract PDF and review every extracted date and figure against its page citation and verbatim quote before applying; confirmed values update the transaction and deadlines become dated tasks. Needs `ANTHROPIC_API_KEY` when self-hosting (bundled on Cloud); try it with `apps/web/public/sample-contract.pdf`.
- **Documents & e-signature** — any S3-compatible storage (MinIO bundled in compose; zero-config Postgres fallback), merge-field document templates rendered to PDF, and a per-client e-signature envelope layer: Manual works out of the box, the Documenso adapter is live-verified (spin up a local instance with `docker-compose.documenso.yml`), DocuSign activates on config.
- **Portals, team & vault** — shareable client/buyer/seller portals on revocable per-link tokens, team management with roles and link-based invitations, and a credential vault (MLS/lender logins envelope-encrypted at rest, revealed only on click, every reveal audited — Freehold never logs into anything automatically).
- **Cloud & billing** — Stripe subscriptions with a free tier and graceful limits that never lock data (existing work stays readable and exportable). Limits apply **only** when `FREEHOLD_CLOUD=1` — self-hosted Freehold is unlimited, always.
- **Email & comms** — transactional email via Resend (branded HTML from the workspace's own address, replies threading back onto the transaction) plus a full email template studio: a starter library with merge fields, per-task suggestions with one-click compose and attachments, Deepgram voice dictation, a workspace signature/footer, automated intro/post-close emails, optional auto-send on task completion, quiet hours, and scheduled sends.
- **Security & platform** — TOTP two-factor auth with backup codes, at-rest document encryption (envelope AES-256-GCM), six-digit email verification on Cloud signups, per-workspace marketing sites on subdomains with logo upload and buy-/sell-side intake forms, CSV import, a REST API with signed webhooks, client invoicing, and integrations: Zapier, Follow Up Boss, Twenty CRM, per-tenant Documenso, and a Claude Skill.

On the roadmap: saved views, role-based task auto-assignment, background jobs, a Dotloop adapter, Bitwarden import/export, a template marketplace, BYO-Twilio SMS, and a RESO MLS adapter.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) |
| Backend | Node/TypeScript |
| Database | PostgreSQL + Prisma, row-level tenancy |
| Queue | Redis + BullMQ |
| Object storage | Any S3-compatible endpoint (bundled default for self-host) |
| AI | Claude API — your own Anthropic key when self-hosting, included on Cloud |
| Email | Resend (free tier works for self-hosting; replies thread back onto transactions) |
| SMS | Bring your own Twilio or Vonage account |
| E-signature | Adapter interface: Documenso (bundled, arm's-length) · DocuSign · Dotloop |
| Payments | Stripe + Stripe Connect (tenants invoice their own clients) |

## Repo layout

```
apps/
  web/                Next.js frontend
  api/                Node/TS backend
packages/
  db/                 Prisma schema + migrations
  ui/                 shared component library
  workflows/          action plan / task engine
  importers/          import framework + vendor importers
  integrations/       adapter interfaces (e-sign, email, SMS, CRM) + open adapters
  vault/              credential vault (encryption + audit)
ee/                   commercial license — Freehold Cloud billing/plan gating only
services/
  esign-bridge/       Documenso API wrapper
  comms-bridge/       webhook surface for SMS/voice add-ons
docs/
  PLAN.md             full architecture + roadmap
  plan.html           styled version of the same plan
```

Everything a working TC needs day-to-day lives in the source-available (Elastic License 2.0) core. The small [`ee/`](ee/) folder (commercial license, Cal.com-style) contains only Cloud billing and plan gating. One private companion repo (`freehold-infra`) holds cloud operations and the Hub (news feed, marketplace index, telemetry) — nothing in it is needed to self-host.

## Getting started

**Self-host (one machine, one command)** — full walkthrough in [docs/SELF-HOSTING.md](docs/SELF-HOSTING.md):

```bash
cp .env.example .env            # set BETTER_AUTH_SECRET: openssl rand -base64 32
docker compose up -d            # Postgres, Redis, migrations, web (:3000), api (:3001)
```

**Local development:**

```bash
pnpm install
cp .env.example .env            # set BETTER_AUTH_SECRET; defaults match the dev compose file
ln -s ../../.env apps/web/.env.local   # Next.js reads env from the app dir
docker compose -f docker-compose.dev.yml up -d    # just Postgres + Redis
pnpm db:migrate                 # apply Prisma migrations
pnpm dev                        # web on :3000, api on :3001
```

## Telemetry

Instances send an anonymized install ping and daily heartbeat (instance ID, version, tenant count). Disable it with `FREEHOLD_TELEMETRY_DISABLED=1` — the app functions identically either way.

## License

Elastic License 2.0 — see [`LICENSE`](LICENSE). In plain terms: use it, modify it, and self-host it free for your own organization. You may not provide Freehold to third parties as a hosted or managed service, resell it, or offer it under another brand — not even a single hosted copy; Freehold Cloud is the hosted offering. The `ee/` directory is licensed separately (commercial); it is not required to run, build, or self-host Freehold.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Note: a signed CLA is required before any external contribution can be merged.
