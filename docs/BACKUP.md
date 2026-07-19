# Backups & disaster recovery

Freehold Cloud's entire state lives in two places: **the Postgres database**
(all tenant data, including envelope-encrypted documents and credentials) and
**the environment secrets** (most critically `VAULT_MASTER_KEY`). Everything
else — code, migrations, config — is in this repository.

## What runs automatically

| Layer | What | Where | Retention |
|---|---|---|---|
| Neon point-in-time restore | Continuous | Neon console → Restore | ~7 days |
| Nightly offsite dump | `pg_dump`, gzipped, AES-256 encrypted | GitHub Actions artifacts on this repo ([backup workflow](../.github/workflows/backup.yml), 07:17 UTC daily) | 30 days |

The nightly dump exists so a total Neon failure is survivable. Secrets used:
`BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE` (repo secrets; the passphrase is
also in `.env`).

## The rule that matters most

**A database backup without `VAULT_MASTER_KEY` cannot recover credentials or
documents.** They are envelope-encrypted at the application layer; the key
never lives in the database. Keep offline copies of:

- `VAULT_MASTER_KEY`
- `BACKUP_PASSPHRASE`
- The rest of `.env` (Stripe, Resend, auth secret, price IDs)

Password manager **plus** a printed copy somewhere physical. This is a launch
blocker — see TODO.

## Restore runbook (move to a new server / Neon is gone)

1. **Get a dump.** Either Neon PITR → new branch → `pg_dump` it, or download
   the latest artifact from the Actions "Nightly database backup" run.
2. **Decrypt** (skip if from Neon):
   ```sh
   openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE \
     -in freehold-YYYYMMDD.sql.gz.enc | gunzip > freehold.sql
   ```
3. **Provision Postgres** anywhere (Neon, RDS, a box). Create the database.
4. **Restore:** `psql "$NEW_DATABASE_URL" < freehold.sql`
5. **Recreate the app role** and grants: run `scripts/vercel-db-setup.mjs`
   with the new owner URL (it creates `freehold_app`, applies grants, and
   runs `prisma migrate deploy` — idempotent).
6. **Point the app at it:** update the database env vars on Vercel (or the
   new host), set the rest of `.env` from your offline copy — the same
   `VAULT_MASTER_KEY`, or nothing encrypted opens.
7. **Deploy and smoke-test:** sign in, open a transaction, reveal a vault
   credential, download a document. If those four work, everything works.
8. DNS only changes if you moved off Vercel.

## Self-hosters

`pg_dump` + your `.env` file is a complete backup. If you use S3/MinIO
storage, add that bucket. Same master-key rule applies.
