# packages/db

Prisma schema and migrations, shared by `apps/api`.

Tenant-per-row isolation via `tenant_id` + Postgres Row-Level Security, enforced on every domain table.
