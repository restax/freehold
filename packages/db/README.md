# packages/db

Prisma schema and migrations, shared by `apps/api`.

Tenant-per-row isolation via `tenant_id` + Postgres Row-Level Security — see [Data model sketch](../../docs/PLAN.md#data-model-sketch) and [Multi-tenancy](../../docs/PLAN.md#multi-tenancy--custom-domains) in the plan.
