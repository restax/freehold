#!/bin/sh
# Runs once on first Postgres boot (docker-entrypoint-initdb.d).
#
# The application must NOT connect as the database owner/superuser: Postgres
# row-level security — Freehold's tenant-isolation layer — is bypassed for
# superusers. This creates a plain role for the app; migrations keep using
# the owner connection.
set -e

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE freehold_app LOGIN PASSWORD '${POSTGRES_APP_PASSWORD:-freehold_app}';
  GRANT USAGE ON SCHEMA public TO freehold_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE "$POSTGRES_USER" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO freehold_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE "$POSTGRES_USER" IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO freehold_app;
EOSQL
