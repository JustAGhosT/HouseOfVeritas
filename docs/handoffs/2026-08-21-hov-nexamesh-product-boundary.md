# HOV and NexaMesh product-boundary handoff

Date: 2026-08-21

## Outcome

House of Veritas is documented as a distinct NexaMesh vertical product: an intelligent physical estate governed by AI. NeuralLiquid remains an external intelligence-services provider. Current sensing, edge-agent, mesh, and physical-automation maturity is stated conservatively, and the existing repository, hostname, and runtime remain unchanged.

## Why this changed

Earlier portfolio and migration material provisionally placed HOV under NeuralLiquid and did not consistently separate product ownership from the current repository and infrastructure footprint. The accepted product decision requires one cross-portfolio story without implying that roadmap physical capabilities or a production migration have already shipped.

## Changed HOV files

- `CLAUDE.md`
- `README.md`
- `docs/01-product/01-platform-specification.md`
- `docs/02-architecture/05-persistence-strategy-adr.md`
- `docs/02-architecture/13-database-hosting-adr.md`
- `docs/02-architecture/14-nexamesh-product-boundary-adr.md`
- `docs/03-deployment/06-mvp-launch-checklist.md`
- `docs/README.md`
- This handoff

Companion PRs carry the NeuralLiquid migration gates, NexaMesh family ADR, and authoritative org-meta registry amendment:

- [NeuralLiquid PR #19](https://github.com/neuralliquid/neuralliquid-org/pull/19)
- [HOV PR #203](https://github.com/neuralliquid/house-of-veritas/pull/203)
- [NexaMesh PR #962](https://github.com/Nexamesh/nexamesh-core/pull/962)
- [org-meta PR #107](https://github.com/JustAGhosT/org-meta/pull/107)

## Verification

- `pnpm exec prettier --check CLAUDE.md README.md docs/01-product/01-platform-specification.md docs/README.md docs/02-architecture/14-nexamesh-product-boundary-adr.md docs/handoffs/2026-08-21-hov-nexamesh-product-boundary.md`
- `git diff --check`
- Exact-head GitHub Deployment Checklist and bot review must be green before merge.

## Next owner and boundary

The HOV and NexaMesh infrastructure owners jointly own any later migration plan. Before execution they must inventory the Celladore Systems tenant, validate the isolated `nex-prod-hov-rg` design, produce a migration-specific Terraform plan with separate state, and prove an independently restorable HOV datastore.

This documentation does not authorize Terraform applies, tenant changes, database export or migration, DNS changes, identity changes, or repository transfer. `hov.neuralliquid.ai` remains the compatibility hostname until a separately approved, reversible cutover.
