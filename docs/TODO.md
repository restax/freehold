# Master to-do list

The single list of everything open across stages. Items move to ~~struck~~ with a date when done.

## Launch blockers (Stage 06 exit: repo public, demo live, first outside signups)

- [x] **CLA final legal text** in [CLA.md](CLA.md) (Apache ICLA V2.2 adaptation with dual-license grant); signing gate workflow already in place *(2026-07-18)*
- [x] **Self-hosting guide** at [SELF-HOSTING.md](SELF-HOSTING.md); site buttons and footer now link to it *(2026-07-18)*
- [ ] **Seeded demo instance** — fictional brokerage strangers can explore
- [ ] **Launch posts** — Show HN, Product Hunt, r/selfhosted drafts
- [x] **Pushed to github.com/restax/freehold** (private; history triple-scrubbed: secrets, personal names, banned words; CI green). Flip to public when ready: `gh repo edit restax/freehold --visibility public` *(2026-07-18)*
- [x] **Vercel deploy** of freeholdtc.dev *(2026-07-18)* — LIVE with TLS: project `freehold` (root `apps/web`, turbo build), Hostinger nameservers → Vercel DNS with all email records (MX/SPF/DKIM/DMARC/autodiscover) pre-copied so hello@/partners@ kept working, www 308→apex. Neon Postgres via Marketplace: build step `scripts/vercel-db-setup.mjs` creates non-owner `freehold_app` role + runs `prisma migrate deploy` + grants each deploy; runtime derives its connection from `STORAGE_DATABASE_URL` with `freehold_app` credentials (RLS intact). Stripe test-mode webhook endpoint live at /api/webhooks/stripe (subscriptions + invoices). Verified end-to-end on prod: signup → workspace create → dashboard, /api/health db:true. Leftovers: smoke-test account (smoketest@freeholdtc.dev / "Smoke Test TC") to delete when demo-seeding; `REDIS_URL` still placeholder (nothing uses it yet); apps/api (Fastify) not on Vercel — host separately when public API goes live.
- [x] **hello@freeholdtc.dev mailbox** set up; partners@ already existed *(2026-07-18)*
- [ ] OG/social share image for freeholdtc.dev (Higgsfield once Paul's paid account is logged in: `higgsfield auth login`)

## Marketing honesty items (site currently promises these)

- [ ] Free-tier "AI extraction trial credits" — either implement credit limits or change the pricing page line (Free currently gets full AI)
- [ ] Partner account / fleet dashboard / consolidated invoicing — pricing page states it as current; build or soften before launch
- [ ] "White-glove onboarding" + "first access to reporting" on Business tier — define what these actually are

## Product backlog (pre-launch polish)

- [ ] DocuSign adapter live test (only adapter never exercised with real credentials)
- [ ] Extraction prompt: request 2-letter state codes
- [ ] Duplicate party roles (two sellers) collide on one custom-field key — needs suffixing
- [ ] Member-role button hiding in UI (server-side gating exists; buttons still render)
- [ ] Data export (site promises "exports in full"; needs a real one-click export)
- [ ] Custom 404 exists; add error.tsx boundary pages
- [ ] Telemetry ping implementation (currently a stub; needs Hub endpoint)
- [ ] Bitwarden import/export for the vault
- [ ] Portal logo branding upload

## Stage 07 — Importers + integrations round 1 (in progress)

- [x] Import framework: CSV parser + header auto-mapping + dry-run preview *(2026-07-18)*
- [x] Generic CSV import for contacts and transactions (UI at /dashboard/import, sample CSV included) *(2026-07-18)*
- [ ] Vendor presets: header aliases cover the major legacy platforms' export shapes; still need verification against real export samples
- [ ] Gmail / Google Calendar tenant connections: each TC connects their own account (send email as themselves, push deadlines to their calendar). Requires one Freehold-owned Google Cloud OAuth app (client ID/secret; self-hosters register their own). Gmail send scope is restricted: Google app verification review needed before public production — start early. Outlook/Microsoft equivalent after.
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
