# Self-hosting Freehold

Freehold is free to self-host, forever, with every feature and no limits.
This guide takes you from nothing to a running instance. If you can copy and
paste a few commands, you can do this; if you'd rather not, our setup service
will do it for you (hello@freeholdtc.dev), or use [Freehold Cloud](https://freeholdtc.dev).

## What you need

- **A machine that stays on.** A cloud VPS ($5 to $10/month), a home server, or
  that unused office PC. 4 GB of RAM is comfortable; 2 GB works.
- **Docker.** Install [Docker Desktop](https://docs.docker.com/get-docker/)
  (Mac/Windows) or Docker Engine + Compose (Linux). That's the only software
  prerequisite; Docker brings everything else.
- **Optional, for the AI:** an [Anthropic API key](https://console.anthropic.com)
  for contract extraction. Pay-as-you-go; a typical contract costs a few cents
  to read. Everything else works without it.

## Install

```bash
# 1. Get the code
git clone https://github.com/restax/freehold
cd freehold

# 2. Create your configuration
cp .env.example .env

# 3. Set the two required secrets in .env
#    BETTER_AUTH_SECRET  - generate with: openssl rand -base64 32
#    VAULT_MASTER_KEY    - generate with: openssl rand -base64 32
#    (VAULT_MASTER_KEY encrypts the credential vault. Store a copy somewhere
#     safe: lose it and vault contents are unrecoverable, by design.)

# 4. Start everything
docker compose up -d
```

That brings up Postgres, Redis, MinIO object storage, runs database
migrations, and starts the web app on port 3000 and the API on port 3001.

Open `http://localhost:3000` (or `http://<machine-ip>:3000` from another
computer on your network), create your account, and name your workspace. The
first account is the owner. Start with the sample data if you want to look
around before importing your own.

## Optional configuration (all in `.env`)

| What | Keys | Notes |
|---|---|---|
| AI contract extraction | `ANTHROPIC_API_KEY` | Without it, everything works except the Extract button |
| E-signatures via Documenso | `DOCUMENSO_URL`, `DOCUMENSO_API_TOKEN` | `docker-compose.documenso.yml` runs a local Documenso; see its header comments |
| E-signatures via DocuSign | `DOCUSIGN_*` | Config-gated; appears once set |
| External S3 storage | `STORAGE_S3_*` | Any S3-compatible service; bundled MinIO is the default |
| Client invoicing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Your own Stripe account; invoices go out under your name |
| Email + reply capture | `RESEND_API_KEY`, `EMAIL_FROM_DOMAIN`, `EMAIL_REPLY_DOMAIN`, `RESEND_WEBHOOK_SECRET` | A free Resend account and one verified domain; replies thread back onto transactions |

## Reaching it from the internet (optional)

For client portals and e-sign links to work away from your office network,
put Freehold behind a domain with HTTPS. The simplest path is
[Caddy](https://caddyserver.com) on the same machine:

```
freehold.yourdomain.com {
    reverse_proxy localhost:3000
}
```

Point the domain's DNS at your machine, set
`BETTER_AUTH_URL=https://freehold.yourdomain.com` in `.env`, and restart
(`docker compose up -d`). Caddy handles certificates automatically. A
Cloudflare Tunnel or Tailscale Funnel works just as well if you can't open
ports.

## Backups

Your data is one Postgres database plus uploaded documents. Back up both:

```bash
# Database: run nightly via cron, keep copies somewhere off the machine
docker compose exec -T db pg_dump -U postgres freehold > freehold-$(date +%F).sql

# Documents: only if using the bundled MinIO (external S3 has its own durability)
docker compose cp minio:/data ./minio-backup-$(date +%F)
```

To restore: fresh install, then `psql` the dump back in and copy the MinIO
data directory into place before `docker compose up`.

## Updating

```bash
git pull
docker compose build
docker compose up -d   # migrations run automatically on start
```

Releases note anything that needs more than this; the goal is that updates
are always painless.

## Troubleshooting

- **Port already in use:** something else owns 3000/3001. Change the exposed
  ports in `docker-compose.yml` or stop the other service.
- **Blank page or 500s right after start:** migrations may still be running.
  `docker compose logs migrate` to watch; give it a minute on first boot.
- **Extraction fails:** check `ANTHROPIC_API_KEY` is set and the machine can
  reach the internet.
- **Forgot the vault key:** vault entries cannot be recovered without
  `VAULT_MASTER_KEY`. Everything else in Freehold is unaffected.
- **Anything else:** open an issue at
  [github.com/restax/freehold](https://github.com/restax/freehold/issues)
  with the output of `docker compose logs --tail 100`.

## Uninstalling

```bash
docker compose down          # stop (data volumes are kept)
docker compose down -v       # stop AND delete all data, irreversible
```

Your data is always yours: `pg_dump` gives you everything in a portable
format, whether you're moving to another server, to Freehold Cloud, or away
from Freehold entirely.
