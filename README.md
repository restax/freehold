# Freehold

*Working name (formerly "Keystone") — final name/domain purchase pending.*

An AI-enabled real estate transaction management and CRM platform for brokerages and transaction coordinators — one system of record for listings, contracts, contacts, and closings. **Fully open source (Apache-2.0). Self-hosting is free and unlimited, forever — no license keys, no caps.** Revenue comes from Freehold Cloud (the hosted version), setup/migration services, and a template marketplace — not from restricting this repo.

The flagship AI feature: upload a purchase contract and Freehold extracts every key date and figure — page-cited, confidence-scored, human-confirmed before anything enters the record. No guessing.

See [`docs/PLAN.md`](docs/PLAN.md) for the full architecture and staged build plan (or [`docs/plan.html`](docs/plan.html) — same content, styled; open it in a browser).

**Status:** pre-alpha — Stage 00 (foundations) is in: auth (email/password, OAuth-ready), three-level tenancy (tenant → client → user) with Postgres row-level security, Docker Compose bundle, CI, and the CLA gate. Signup → workspace creation → dashboard shell works end-to-end. Stage 01 (transactions + CRM) is next.

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
