# Contributing

Freehold's core is source-available (Elastic License 2.0 — free to use, modify, and self-host for your own organization; never resellable or hostable for others) and open to contributions once Stage 00 lands (see [`docs/PLAN.md`](docs/PLAN.md) for the build sequence — early stages are foundational and best coordinated before large PRs).

## Contributor License Agreement (required)

Because a commercial tier (Freehold Cloud, `ee/`) is sold alongside the source-available core, **all contributors must sign a CLA before any code is merged**. This preserves the legal flexibility to sustain the project commercially while fully welcoming and crediting community contributions.

- Signing is automated via CLA Assistant on your first PR — no paperwork beyond a click.
- The agreement is a standard, widely used template (Apache Software Foundation ICLA / contributoragreements.org — final text published before the repo opens to external PRs).

> Maintainer setup note: CLA Assistant must be configured **before** the first external PR is merged.

## Workflow

1. Fork and branch off `main`.
2. `pnpm install`, then `pnpm lint && pnpm typecheck && pnpm test` before opening a PR.
3. Open a PR against `main`. CI runs lint/typecheck/test automatically (Stage 00).
4. Keep PRs scoped to one stage/module where possible — the plan doc's stage boundaries are also good PR boundaries.

## Scope boundary

- Almost everything is core and open: transaction management, CRM, portals, workflows, importers, integrations, the credential vault, backups, reporting.
- The `ee/` directory (Cloud billing/plan gating) is commercially licensed — contributions there are welcome but land under that license.
- Provider access is bring-your-own-key through adapter interfaces in `packages/integrations` — new adapters (e-sign, SMS, MLS, CRM) are the most valuable contributions and should implement the existing interface rather than call provider SDKs directly from app code.

## Reporting issues

Open a GitHub issue. Security issues: do not open a public issue — contact the maintainers directly (contact method TBD before public launch).
