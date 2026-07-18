# Freehold

*Working name (formerly "Keystone") — final name/domain purchase pending.*

An AI-enabled real estate transaction management and CRM platform for brokerages and transaction coordinators — one system of record for listings, contracts, contacts, and closings. **Fully open source (Apache-2.0). Self-hosting is free and unlimited, forever — no license keys, no caps.** Revenue comes from Freehold Cloud (the hosted version), setup/migration services, and a template marketplace — not from restricting this repo.

The flagship AI feature: upload a purchase contract and Freehold extracts every key date and figure — page-cited, confidence-scored, human-confirmed before anything enters the record. No guessing.

See [`docs/PLAN.md`](docs/PLAN.md) for the full architecture and staged build plan (or [`docs/plan.html`](docs/plan.html) — same content, styled; open it in a browser).

**Status:** pre-alpha — Stages 00–05 are in. Foundations (auth, tenant → client → user tenancy with enforced Postgres row-level security, Docker Compose bundle, CI, CLA gate) plus core transaction management: transactions with custom fields, contacts, clients, parties, tasks, and action plans whose template tasks anchor to contract/close dates and auto-compute deadlines when applied. Pipeline dashboard, removable sample data, onboarding wizard. Stage 02 adds the flagship AI feature: upload a purchase contract PDF, review every extracted date and figure against its page citation and verbatim quote, and apply — confirmed values update the transaction, deadlines become dated tasks. Requires `ANTHROPIC_API_KEY` (try it with `apps/web/public/sample-contract.pdf`). Stage 03 adds the storage abstraction (any S3-compatible service via env; MinIO bundled in compose; zero-config Postgres fallback), merge-field document templates rendered to PDF, and the e-signature envelope layer with per-client provider choice — Manual (track wet-ink/outside signatures) works out of the box; the Documenso adapter is live-verified (spin up a local instance with `docker-compose.documenso.yml` — see the header comments); DocuSign activates on config and awaits first live testing. Stage 04 adds shareable client portals (token links with per-link content toggles and revocation — text one to your buyer and they see a branded, read-only closing tracker), team management with roles and link-based invitations, and the credential vault: client logins (MLS, lender portals) envelope-encrypted at rest, revealed only on click, every reveal audited — Freehold never logs into anything automatically. Stage 05 adds the Freehold Cloud billing layer (in `ee/`, commercially licensed): Stripe seat subscriptions with a free tier (10 active transactions, 2 seats), graceful limits that never lock data, a Customer Portal for self-service management, and the Hub news panel. Limits apply **only** when `FREEHOLD_CLOUD=1` — self-hosted Freehold is unlimited, always. Deferred and tracked in the plan: email templates/SMTP, saved views, role auto-assignment, async jobs, Dotloop adapter, Bitwarden import/export, portal logo branding. Next: public cloud deployment + Stage 06 launch assets.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) |
| Backend | Node/TypeScript |
| Database | PostgreSQL + Prisma, row-level tenancy |
| Queue | Redis + BullMQ |
| Object storage | Any S3-compatible endpoint (bundled default for self-host) |
| AI | Claude API — your own Anthropic key when self-hosting, included on Cloud |
| Email | Any SMTP provider |
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
  PLAN.md             full architecture + staged build plan
  plan.html           styled version of the same plan
```

Everything a working TC needs day-to-day lives in the Apache-2.0 core. The small [`ee/`](ee/) folder (commercial license, Cal.com-style) contains only Cloud billing and plan gating. One private companion repo (`freehold-infra`) holds cloud operations and the Hub (news feed, marketplace index, telemetry) — nothing in it is needed to self-host.

## Getting started

**Self-host (one machine, one command):**

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

Apache-2.0 — see [`LICENSE`](LICENSE). The `ee/` directory is licensed separately (commercial); it is not required to run, build, or self-host Freehold.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Note: a signed CLA is required before any external contribution can be merged.
