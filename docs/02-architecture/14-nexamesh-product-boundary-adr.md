# ADR-014: House of Veritas as a NexaMesh Physical-Estate Product

**Status:** Accepted
**Date:** 2026-08-21
**Decider:** Jurie (owner)
**Supersedes:** The undocumented assumption that HOV is a NeuralLiquid product

---

## Context

House of Veritas was placed in the NeuralLiquid portfolio and its future Azure
migration was consequently aimed at `neuralliquid-sub`. That placement was not
supported by a product-level architecture decision.

The authoritative product thesis is:

> House of Veritas is an intelligent physical estate governed by AI.

HOV is not only a document or estate-administration application. It is the
estate's command and governance layer: a durable model of people, spaces,
assets, vehicles, work, money, obligations, incidents, evidence, and decisions.
NexaMesh is the physical-world platform that can provide trusted device
identity, sensing, local execution, mesh transport, and provenance.

The distinction between current and intended capability is material. HOV's
current production value is its human-facing estate control plane and digital
workflows. Sensor ingestion, device twins, local edge agents, and automated
physical responses are not yet production capabilities.

## Options considered

| Option                      | Benefits                                                                                  | Costs and risks                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Keep HOV in NeuralLiquid    | Matches the current repository and hostname; minimal portfolio change                     | Treats the physical-estate thesis as incidental and makes NexaMesh a peripheral integration            |
| Make HOV a NexaMesh product | Aligns the product with physical-world AI and gives NexaMesh a concrete civilian vertical | Requires coordinated story, infrastructure, data, DNS, and repository transition work                  |
| Make HOV fully standalone   | Strongest brand and compliance isolation                                                  | Adds another control plane before scale justifies it; loses the explicit platform/product relationship |

## Decision

HOV is a distinct product in the NexaMesh family and the first reference
vertical built on the NexaMesh physical-world platform.

HOV is not absorbed into `nexamesh-core`. It continues to own its application,
estate domain model, sensitive records, product roadmap, and acceptance
criteria. NexaMesh provides reusable platform contracts and infrastructure.
NeuralLiquid services may continue to provide reasoning, model routing,
document intelligence, or analytics through explicit external contracts.

The intended Azure destination is an isolated `nex-prod-hov-rg` boundary in
`nexamesh-sub`. A dedicated `hov-sub` remains a future option if privacy,
regulatory, restore, commercial, or blast-radius requirements outgrow
subscription-level isolation.

## Ownership boundary

| HOV owns                                                                                                           | NexaMesh owns                                                                                                                      | External intelligence providers own                                                    |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Estate people, roles, policy, work, assets, incidents, documents, finance, decisions, and retained domain evidence | Device identity, trusted observations, edge execution, mesh transport, device health, generic telemetry, and provenance primitives | Model execution, document analysis, or other narrowly contracted intelligence services |

A NexaMesh observation is input, not estate truth by itself. HOV authenticates
the event, applies estate policy and human authority, records the resulting
incident or task, and preserves the decision and outcome.

Shared platform services receive only the minimum data required by their
contract. Co-location in `nexamesh-sub` does not grant access to household,
employee, biometric, legal, financial, or identity records.

## Current-to-future capability statement

### Live foundation

- Role-aware estate dashboards and operational workflows
- Documents and signing integration
- Tasks, time, expenses, assets, inventory, vehicles, maintenance, and incidents
- Audit, governance, and AI-assisted guidance surfaces
- Azure-hosted application, storage, Key Vault, monitoring, and external services

### Next architecture

- Authenticated physical observations linked to HOV assets and locations
- Explicit device-to-estate event contracts
- Estate digital-twin projections derived from observations and governed records
- Human-reviewed automation with audit and rollback

### Later, evidence-gated capabilities

- Local/offline NexaMesh edge agents
- Sensor fusion and resilient mesh transport
- Policy-constrained automated physical responses
- Multi-property or commercial estate deployments

Roadmap capability must not be described as deployed until implementation,
runtime configuration, and acceptance evidence exist.

## Infrastructure and migration consequences

- Do not apply the current production Terraform against `nexamesh-sub`; its
  backend and import IDs point at the existing source subscription.
- Build a new HOV-specific backend and target configuration, then review a
  complete create/import/cutover plan.
- Move HOV off the NeuralLiquid shared PostgreSQL server during migration so
  the new product boundary has an independent restore and credential path.
- Resolve whether `sign.nexamesh.ai` and `ops.nexamesh.ai` are shared NexaMesh
  services or HOV-owned services before runtime cutover.
- Preserve `hov.neuralliquid.ai` as a compatibility hostname until DNS, TLS,
  Auth.js, Mystira OIDC callbacks, and legitimate user acceptance pass on an
  explicitly approved canonical hostname.
- Migration execution, secret rotation, DNS changes, data transfer, and source
  retirement remain separately approval-gated.

## Consequences

### Positive

- HOV's product identity now matches its intended physical-world purpose.
- NexaMesh gains a concrete product family rather than only a platform thesis.
- Sensitive estate records retain a clear product owner.
- Present capability and future ambition are separated honestly.

### Negative

- Existing NeuralLiquid naming, hosting, shared data, identity, and repository
  dependencies require a staged migration.
- The platform/product contract must be designed and maintained across
  repositories.
- NexaMesh positioning must expand beyond counter-UAS without implying that
  unbuilt HOV edge capabilities are already available.

## Revisit triggers

Reconsider a dedicated HOV subscription when HOV becomes revenue-generating,
requires independent regulatory assurance or disaster recovery, materially
increases its personal-data volume, or needs a blast radius independent of
other NexaMesh products.

## References

- [NexaMesh product-boundary decision in neuralliquid-org](https://github.com/neuralliquid/neuralliquid-org/blob/main/docs/adr/0004-hov-nexamesh-product-boundary.md)
- [HOV to NexaMesh migration addendum](https://github.com/neuralliquid/neuralliquid-org/blob/main/docs/plans/hov-nexamesh-migration-addendum.md)
- [ADR-013: Database Hosting and Estate Backend Consolidation](./13-database-hosting-adr.md)
