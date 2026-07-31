# Sluice image-generation capability assessment

- **Date:** 2026-07-31
- **House of Veritas source:** `origin/main` at
  `340ca15b4012ee8a490612ba66d504d8908f740c`
- **Sluice production source refs inspected:** `origin/main` at
  `3b1bf0cfdc0a552aacfa051143becf8d16ed564f`; `origin/dev` at
  `d64083f3e9b949537fac93eb7db9aefb6d454258`
- **Sluice production revision:** `pvc-prod-sluice-ca--0000015`, healthy and receiving 100% traffic
- **Sluice production image:**
  `litellm/litellm-database:v1.83.7-stable@sha256:85e3d3ca43ff554b5731b00ef470ce7717f47505e56676afd46ec3a9f5a63466`
- **Baton task:** `871f1848-96ad-4665-9c6e-32cc5daf6bc6`
- **Risk tier:** read-only cross-repository capability assessment

## Decision

**No-go:** do not add or enable a House of Veritas recipe-image execution route.

Production Sluice is healthy and its LiteLLM build exposes a generic authenticated
`POST /v1/images/generations` surface. That route is framework capability, not a proven HOV media
contract. Current Sluice source configures no image-generation model or image alias, the HOV virtual
key policy allows only `cheap-long-context`, and the deployed OpenAPI route declares an empty success
schema. Sluice's own ADR-14 remains `Proposed`; its companion plan says image support is absent and
marks provider routing, media lifecycle telemetry, and the dedicated media route `Not started`.

HOV must keep `execution.allowed=false`, must not persist a generation job or change media status,
and must not fall back to a provider.

## Capability matrix

| Required capability             | Evidence                                                                                                                                                                                                                                                                                              | Status  | Owner / closure condition                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model alias discovery           | `scripts/keys.yaml` allows `house-of-veritas-guidance` only `cheap-long-context`; `infra/modules/sluice_aca/main.tf` has no image model entry. The live model endpoint correctly requires a virtual key, but this operator lacks Key Vault `secrets/get`, so no authenticated live list was captured. | Missing | Sluice must add a server-owned image alias, bind it to the HOV virtual key, and provide authenticated deployed model-list evidence.                                   |
| Authentication                  | Live unauthenticated `GET /v1/models` returned `401`; deployed OpenAPI requires `APIKeyHeader` for image generation; Sluice has a consumer-specific HOV virtual-key policy.                                                                                                                           | Partial | Reuse the existing Bearer virtual-key boundary. Prove the deployed HOV allowlist without exposing the key.                                                            |
| Request and response schema     | Live OpenAPI lists `POST /v1/images/generations`, but its `200` response schema is `{}`. Proposed `/v1/media/compose` returned `404`.                                                                                                                                                                 | Missing | Sluice must publish a versioned image request/result/error schema and contract tests.                                                                                 |
| Request-ID propagation          | ADR-10 accepts caller `metadata.request_id` for logs only. No image response ID/header, stable job ID, or replay contract is implemented.                                                                                                                                                             | Missing | Sluice must echo a stable Sluice request/job ID and preserve the caller correlation ID across logs and results.                                                       |
| Cost reporting                  | Token-shaped spend tracking exists; the proposed per-image media event and Docket ingestion are explicitly not started.                                                                                                                                                                               | Missing | Sluice must emit one idempotent media cost lifecycle; Docket must accept/finalize it.                                                                                 |
| Telemetry                       | Generic metadata, Prometheus, spend-log, and OTEL paths exist. Image outcome, provider, model, output count, latency, and failure evidence are not contracted.                                                                                                                                        | Partial | Sluice must prove image-specific success/failure telemetry with bounded cardinality and no prompt/PII leakage.                                                        |
| Rights enforcement              | ADR-14 explicitly leaves provider output/commercial-use rights to the consumer and has no server-owned image risk branch.                                                                                                                                                                             | Missing | Sluice and HOV owners must define complementary server-enforced provider policy and HOV approval/rights evidence. Caller metadata must not select or weaken the tier. |
| Artifact delivery               | The plan proposes signed provider URLs and says Sluice is not a media store; no implemented result schema or expiry behavior exists.                                                                                                                                                                  | Missing | Sluice must define retrievable bytes or signed-URL semantics, MIME/size/hash fields, expiry, and terminal failure behavior.                                           |
| HOV-managed storage copy        | HOV requires an internal copy before approval/publication; Sluice implements no copy contract and no artifact contract that HOV can safely consume.                                                                                                                                                   | Missing | HOV owns a server-side bounded download, validation, hashing, storage write, and provenance transition after Sluice proves delivery semantics.                        |
| Timeout, retry, and idempotency | Bounded polling, stable job/event IDs, delivery recovery, and retry reuse exist only in the proposed plan for `/v1/media/compose`.                                                                                                                                                                    | Missing | Sluice must implement one upstream job per idempotency key, bounded timeout, retry-safe recovery, and explicit pending/terminal states.                               |
| Failure handling                | Production returns normal LiteLLM auth/method errors, but no versioned image error taxonomy or ambiguity/recovery rule is published.                                                                                                                                                                  | Missing | Sluice must define retryable, terminal, policy, timeout, and ambiguous-delivery errors before HOV can mutate a media lifecycle.                                       |

## Read-only deployed evidence

The following probes made no provider request and incurred no model spend:

```text
GET https://litellm.sluice.phoenixvc.tech/health/liveliness -> 200 application/json
GET https://litellm.sluice.phoenixvc.tech/v1/models -> 401 application/json
GET https://litellm.sluice.phoenixvc.tech/openapi.json -> 200 application/json
GET https://litellm.sluice.phoenixvc.tech/v1/media/compose -> 404 application/json
GET https://litellm.sluice.phoenixvc.tech/v1/images/generations -> 405 application/json
```

Azure read-only inspection confirmed subscription `bb4e3882-2079-4bab-8974-611bc0b8bb58`, the
healthy active revision and immutable image digest above, and 100% traffic to the latest revision.
The live OpenAPI document lists both `/images/generations` and `/v1/images/generations` as
authenticated POST routes, with no typed successful-response body. An attempted authenticated
`/v1/models` read stopped at the legitimate Key Vault boundary because the current operator lacks
`secrets/get`; no credential or session material was exposed.

## Source evidence

- `phoenixvc/sluice:scripts/sluice_router.py` mentions `image_generation` only as an inherited
  LiteLLM hook type; there is no image-specific routing or policy branch.
- `phoenixvc/sluice:infra/modules/sluice_aca/main.tf` configures text/embedding aliases and no image
  model alias on both current `origin/main` and `origin/dev`.
- `phoenixvc/sluice:docs/architecture/14-image-generation-multi-provider-routing.md` is proposed and
  describes the future media surface, rights ownership, and provider shapes.
- `phoenixvc/sluice:docs/planning/image-generation-gateway.md` states zero current image/video
  support and leaves every implementation acceptance criterion not started.
- `lib/recipe-guidance-generation.ts` correctly treats all seven original capabilities as missing,
  returns no provider/model, and keeps execution disabled.

## Next owned slices

1. **Sluice:** publish and implement the smallest first-provider image contract behind virtual-key
   policy. It must cover a server-owned alias, typed request/result/error schemas, stable IDs,
   idempotency, bounded retry/timeout, media cost and telemetry, rights/risk policy, and artifact
   delivery. Deployment and any provider smoke remain separately approval-gated.
2. **House of Veritas:** only after that contract is deployed and proven, add a server-only adapter
   and durable generation ledger. Authorize before the external call, preserve the approved brief
   snapshot and recipe revision, use one idempotency key, copy the terminal artifact into HOV-managed
   storage, validate/hash it, record provenance/cost/telemetry IDs, and leave the media
   `review_required`. The first billable smoke and production write require explicit approval.

## Validation and boundaries

This slice changes documentation only. Validate with focused Prettier and `git diff --check`.
No provider call, generation request, model spend, request persistence, media transition, artifact
copy, deployment, publication, OmniPost action, migration, production-data write, demo-data
enablement, secret rotation, or auth-policy change was performed.

## Trace envelope

- **Task:** `871f1848-96ad-4665-9c6e-32cc5daf6bc6`
- **Routing:** Veritas Atlas with Shield auth/external-effect rules
- **Files inspected:** HOV generation contract and architecture; current Sluice `origin/main` and
  `origin/dev` router, Terraform, virtual-key policy, ADR-10, ADR-14, media plan, and telemetry plan
- **Manual check remaining:** an authorized operator may capture the HOV-key `/v1/models` response
  after Sluice adds an image alias; never expose the key in the evidence
