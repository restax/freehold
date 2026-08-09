# Freehold

Live at [freeholdtc.dev](https://freeholdtc.dev).

An AI-enabled real estate transaction management and CRM platform for brokerages and transaction coordinators — one system of record for listings, contracts, contacts, and closings. **Source-available (Elastic License 2.0): the full code is public, and self-hosting for your own organization is free and unlimited, forever — no license keys, no caps. What the license forbids is redistribution of the product and offering Freehold to others as a hosted or managed service, under any brand. Hosting for clients is what Freehold Cloud is for.** Revenue comes from Freehold Cloud (the hosted version), setup/migration services, and a template marketplace — not from restricting this repo.

The flagship AI feature: upload a purchase contract and Freehold extracts every key date and figure — page-cited, confidence-scored, human-confirmed before anything enters the record. No guessing.

The full architecture and roadmap live in `docs/PLAN.md` (kept local-only, not part of this repo).

**Status:** live in beta — Freehold Cloud runs at [freeholdtc.dev](https://freeholdtc.dev), and the full stack self-hosts from one Docker Compose file.

What's in today:

- **Transactions & CRM** — transactions with unlimited custom fields, contacts, clients, parties, tasks, and action plans whose template tasks anchor to contract/close dates and auto-compute deadlines; pipeline dashboard, a calendar month view of every dated task and closing with high-priority items marked, removable sample data, onboarding wizard. Multi-tenant with enforced Postgres row-level security.
- **Voice search** — ask out loud on any dashboard page ("what's closing this week", "who's the lender on Maple") and hear the answer from live workspace data: Deepgram listens, Claude answers with scoped tool access, ElevenLabs speaks, over a LiveKit realtime session. Also on client portals, where a buyer or agent can ask about their own file — scoped by their capability link, so a spoken answer can never exceed what that link's page already shows. Runs as a separate worker (`services/voice-agent/`); without it the rest of the app is unaffected.
- **AI contract extraction** — upload a purchase contract PDF and review every extracted date and figure against its page citation and verbatim quote before applying; confirmed values update the transaction and deadlines become dated tasks. Needs `ANTHROPIC_API_KEY` when self-hosting (bundled on Cloud); try it with `apps/web/public/sample-contract.pdf`.
- **Documents & e-signature** — any S3-compatible storage (MinIO bundled in compose; zero-config Postgres fallback), merge-field document templates rendered to PDF, and a per-client e-signature envelope layer: OpenSign is bundled and included at no extra cost, with no separate account to create and no per-envelope fee (self-host it with `docker-compose.opensign.yml`; on Cloud the first document you send provisions the workspace automatically). Manual works out of the box, and Documenso (`docker-compose.documenso.yml`) or DocuSign activates on config for teams already running one.
- **Portals, team & vault** — shareable client/buyer/seller portals on revocable per-link tokens, team management with roles and link-based invitations, and a credential vault (MLS/lender logins envelope-encrypted at rest, revealed only on click, every reveal audited — Freehold never logs into anything automatically).
- **Cloud & billing** — Stripe subscriptions with a free tier and graceful limits that never lock data (existing work stays readable and exportable). Limits apply **only** when `FREEHOLD_CLOUD=1` — self-hosted Freehold is unlimited, always.
- **Email & comms** — transactional email via Resend (branded HTML from the workspace's own address, replies threading back onto the transaction) plus a full email template studio: a starter library with merge fields, per-task suggestions with one-click compose and attachments, Deepgram voice dictation, a workspace signature/footer, automated intro/post-close emails, optional auto-send on task completion, quiet hours, and scheduled sends.
- **Security & platform** — TOTP two-factor auth with backup codes, at-rest document encryption (envelope AES-256-GCM), six-digit email verification on Cloud signups, per-workspace marketing sites on subdomains with logo upload and buy-/sell-side intake forms, CSV import, a REST API with signed webhooks, client invoicing (payment-agnostic — a tracked document and follow-up task, with an optional per-tenant ERPNext connection that creates the Sales Invoice there and mirrors its status back), in-app support tickets (a "report an issue" box in the sidebar tags itself with the page you were on; reply threads on both the tenant's own tickets page and an operator queue), and integrations: Zapier, Follow Up Boss, Twenty CRM, ERPNext, per-tenant OpenSign, Documenso, or DocuSign, and a Claude Skill.
- **Licensing, assignment & coordinator network** — per-user, per-state license tracking with expiry alerts; unlimited transaction assignment with per-assignee role labels (no fixed two-person cap); per-tenant operating states with a warn-or-block license-enforcement switch; a coordinator directory merging Freehold-enabled workspaces with the public FindTCPros feed, filterable by state, specialty, and software; cross-tenant engagements that grant another workspace's coordinator scoped guest access to exactly one file; and per-transaction pay requests, so an assignee can request payment on completed work and an admin marks it paid against an itemized statement.

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
| E-signature | Adapter interface: OpenSign (bundled, arm's-length) · Documenso · DocuSign · Manual |
| Billing | Stripe (Cloud subscriptions only) — client invoicing is payment-agnostic, with an optional per-tenant ERPNext connection for accounting |

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
  voice-agent/        LiveKit worker for voice search (Python, runs separately)
docs/
  SELF-HOSTING.md     self-hosting walkthrough
  CLA.md              contributor license agreement
  BACKUP.md           client-owned backup setup
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
