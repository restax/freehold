# Master to-do list

The single list of everything open across stages. Items move to ~~struck~~ with a date when done.

## Launch blockers (Stage 06 exit: repo public, demo live, first outside signups)

- [x] **CLA final legal text** in [CLA.md](CLA.md) (Apache ICLA V2.2 adaptation with dual-license grant); signing gate workflow already in place *(2026-07-18)*
- [x] **Self-hosting guide** at [SELF-HOSTING.md](SELF-HOSTING.md); site buttons and footer now link to it *(2026-07-18)*
- [x] **Seeded demo instance** *(2026-07-19)* — "Explore the live demo" on the landing page → `/api/demo` signs visitors into the shared "Maplewood Transactions (Demo)" workspace as a plain member (owner/admin actions locked); Vercel cron wipes and re-seeds nightly at 9:00 UTC via `/api/demo/reset` (CRON_SECRET-guarded); demo only activates when `DEMO_USER_PASSWORD` is set, so self-hosters never expose one
- [ ] **Launch posts** — drafts ready for Paul's review in [launch/](launch/): Show HN, Product Hunt, r/selfhosted *(drafted 2026-07-19; post only after repo flips public + honesty items resolved)*
- [x] **Pushed to github.com/restax/freehold** (private; history triple-scrubbed: secrets, personal names, banned words; CI green). Flip to public when ready: `gh repo edit restax/freehold --visibility public` *(2026-07-18)*
- [x] **Vercel deploy** of freeholdtc.dev *(2026-07-18)* — LIVE with TLS: project `freehold` (root `apps/web`, turbo build), Hostinger nameservers → Vercel DNS with all email records (MX/SPF/DKIM/DMARC/autodiscover) pre-copied so hello@/partners@ kept working, www 308→apex. Neon Postgres via Marketplace: build step `scripts/vercel-db-setup.mjs` creates non-owner `freehold_app` role + runs `prisma migrate deploy` + grants each deploy; runtime derives its connection from `STORAGE_DATABASE_URL` with `freehold_app` credentials (RLS intact). Stripe test-mode webhook endpoint live at /api/webhooks/stripe (subscriptions + invoices). Verified end-to-end on prod: signup → workspace create → dashboard, /api/health db:true. Leftovers: test accounts to delete eventually (smoketest@freeholdtc.dev / "Smoke Test TC", onboarding-test@freeholdtc.dev / "Onboarding Test Co"); `REDIS_URL` still placeholder (nothing uses it yet); apps/api (Fastify) not on Vercel — host separately when public API goes live.
- [x] **hello@freeholdtc.dev mailbox** set up; partners@ already existed *(2026-07-18)*
- [x] OG/social share image *(2026-07-19)* — Higgsfield Soul V2 photo (Flux Kontext pass removed AI-gibberish lettering) + real Outfit type overlay, rendered at 2x via headless Chrome; installed as `apps/web/src/app/opengraph-image.png` + `twitter-image.png` (Next file convention, alt text included), verified live in meta tags

## Marketing honesty items (site currently promises these)

- [x] Free-tier "AI extraction trial credits" — implemented *(2026-07-19)*: 10 lifetime trial extractions on Cloud Free (durable `ai_extractions_used` counter on organization; consumed only on success; enforced in the action, surfaced on the Extract button and billing page; paid tiers fair-use unmetered; demo reset refreshes credits; pricing page says "10 AI contract extractions to try it")
- [x] Partner account / fleet dashboard / consolidated invoicing — pricing page reworded to honest "works today vs in development" framing with partners@ CTA *(2026-07-19)*
- [x] Business tier definitions *(2026-07-19)* — "White-glove onboarding" → "Onboarding done with you: send your exports, we set up your workspace on a call"; "first access to reporting and invoicing" → "Early access to new features, reporting first" (invoicing is live, now listed on Pro)

## Growth & operations (added 2026-07-19)

- [x] **Operator admin panel** at `/admin` *(2026-07-19)* — workspaces table (plan, seats, active txns vs cap, AI credits used, Stripe customer link), topline stats (tenants, paying, MRR, users, 7-day signups), recent signups; read-only; gated by `PLATFORM_ADMIN_EMAILS` env (set to Paul's email on Vercel; unset on self-host = no panel)
- [x] **Site chatbot messenger** *(2026-07-19)* — Claude-powered widget on all marketing pages (`/api/chat`, honest system prompt with real pricing/features, points to hello@ when unsure); every conversation forwards to Slack when the webhook is configured
- [x] **Slack operator alerts** *(2026-07-19, scaffolded)* — new signups, plan changes, chat messages post to `SLACK_ADMIN_WEBHOOK_URL`. **(Paul)** create the webhook: api.slack.com/apps → Create App → Incoming Webhooks → pick channel → copy URL → add as `SLACK_ADMIN_WEBHOOK_URL` in Vercel env (no approval process)
- [x] **Website tracking** *(2026-07-19, scaffolded)* — Vercel Web Analytics component mounted (**Paul**: enable the toggle at vercel.com → freehold project → Analytics tab); PostHog wired for robust events/funnels (**Paul**: free account at posthog.com → project API key → add `NEXT_PUBLIC_POSTHOG_KEY` in Vercel env, then redeploy)
- [ ] **Tenant messaging notifications** — per-workspace Slack/Discord/Telegram webhooks for transaction/task events (all approval-free; WhatsApp + FB Messenger intentionally skipped — Meta review required, same policy as Google)

## Product backlog (pre-launch polish)

- [ ] DocuSign adapter live test (only adapter never exercised with real credentials)
- [ ] Extraction prompt: request 2-letter state codes
- [ ] Duplicate party roles (two sellers) collide on one custom-field key — needs suffixing
- [ ] Member-role button hiding in UI (server-side gating exists; buttons still render)
- [ ] Data export (site promises "exports in full"; needs a real one-click export)
- [ ] Custom 404 exists; add error.tsx boundary pages
- [ ] "Add sample data" button in Settings (inverse of Remove — useful after the onboarding seed was skipped/failed, e.g. Paul's own workspace 2026-07-19)
- [ ] Telemetry ping implementation (currently a stub; needs Hub endpoint)
- [ ] Bitwarden import/export for the vault
- [ ] Portal logo branding upload (subdomain entry pages make this visible now)
- [x] Tenant subdomains *(2026-07-19)* — `acme.freeholdtc.dev` serves a branded client-portal entry page (middleware host routing; portal links display with the tenant subdomain; app paths redirect to apex; wildcard domain + cert on Vercel; works for self-hosters with their own wildcard DNS)
- [ ] Per-tenant custom portal domains (portal.acmerealty.com, CNAME + cert via Vercel API) — natural Business-tier feature; registrar domain-forwarding works today as the manual version
- [ ] Separate client-facing domain (e.g. freehold.estate) if Paul registers one — middleware already keys off one env var

## Stage 07 — Importers + integrations round 1 (in progress)

- [x] Import framework: CSV parser + header auto-mapping + dry-run preview *(2026-07-18)*
- [x] Generic CSV import for contacts and transactions (UI at /dashboard/import, sample CSV included) *(2026-07-18)*
- [ ] Vendor presets: header aliases cover the major legacy platforms' export shapes; still need verification against real export samples
- [ ] Email + calendar connections **without OAuth app reviews** (Paul's decision 2026-07-19 — no Google integration, ever): each TC connects their mailbox via **IMAP/SMTP** (works with any provider; Gmail needs an app password, which requires 2FA on their account — document this in the connect flow) with credentials stored in the existing vault; deadlines publish as a per-user **ICS calendar feed** (secret URL, read-only) that any calendar app subscribes to. Marketing updated to match (integrations page). Note: Microsoft 365 work accounts have basic-auth IMAP disabled by org policy sometimes — the connect flow should say so and fall back to SMTP-only or feed-only gracefully.
- [x] Public API v1 (API keys, transactions/contacts/tasks) + signed webhooks (transaction.created, task.completed) *(2026-07-18)*
- [x] API reference docs page at /docs/api (endpoints, auth, webhook signature verification example) *(2026-07-18)*
- [x] Webhook delivery retries with backoff (3 attempts, 4xx not retried, re-stamped signatures) *(2026-07-18)*
- [ ] Zapier app
- [ ] Twenty CRM two-way sync
- [x] Client invoicing: tenant invoices client via Stripe (hosted payment page, paid-status webhook) *(2026-07-18; live-verified with a paid test invoice)*
- [ ] Per-tenant Stripe Connect accounts for Cloud invoicing (v1 uses the configured platform/self-host key)

## Later stages (per PLAN.md)

- Stage 08: template library + marketplace (revenue share 70/30 proposed, confirm)
- Stage 09: comms round (BYO Twilio/Vonage SMS, reply-to-close, voice bridge)
- Stage 10: hardening + GA (backups to client-owned storage, retention, pen test, load test, RESO MLS adapter)
