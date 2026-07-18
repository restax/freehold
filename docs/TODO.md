# Master to-do list

The single list of everything open across stages. Items move to ~~struck~~ with a date when done.

## Launch blockers (Stage 06 exit: repo public, demo live, first outside signups)

- [ ] **CLA final legal text** in [CLA.md](CLA.md) + signing gate verified — required before the repo goes public
- [ ] **Self-hosting guide** — real step-by-step docs (the pricing page's "Self-hosting guide" button needs a destination)
- [ ] **Seeded demo instance** — fictional brokerage strangers can explore
- [ ] **Launch posts** — Show HN, Product Hunt, r/selfhosted drafts
- [ ] **Push repo to github.com/restax/freehold** (Paul: GitHub auth)
- [ ] **Vercel deploy** of freeholdtc.dev (Paul: Vercel login; then wire domain, Neon Postgres, Upstash Redis)
- [ ] **hello@freeholdtc.dev mailbox** (Paul — features/integrations pages point requests there; partners@ already exists)
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
- [ ] Gmail / Outlook send + log
- [x] Public API v1 (API keys, transactions/contacts/tasks) + signed webhooks (transaction.created, task.completed) *(2026-07-18)*
- [ ] API reference docs page (endpoints, auth, webhook signature verification example)
- [ ] Webhook delivery retries with backoff (v1 is single-attempt best-effort)
- [ ] Zapier app
- [ ] Twenty CRM two-way sync
- [ ] Stripe Connect: tenant invoices their client, gets paid

## Later stages (per PLAN.md)

- Stage 08: template library + marketplace (revenue share 70/30 proposed, confirm)
- Stage 09: comms round (BYO Twilio/Vonage SMS, reply-to-close, voice bridge)
- Stage 10: hardening + GA (backups to client-owned storage, retention, pen test, load test, RESO MLS adapter)
