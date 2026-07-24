# Handoff - Sluice-routed visual task guidance

- **Date:** 2026-07-24
- **Repo:** `C:\Users\smitj\repos\house-of-veritas`
- **Branch:** `codex/task-visual-guidance`
- **Pull request:** [#129 - Add Sluice-routed visual task guidance](https://github.com/neuralliquid/house-of-veritas/pull/129)
- **Feature task:** `ef9d8563-df5d-4675-858f-863cd859459b` (done)
- **Runtime follow-up:** `1c26a6f4-684c-4f2d-92f5-746b9b4cf62b` (todo)
- **Status:** Implementation complete, PR ready and green; production secret and runtime verification remain.

## Goal

Provide reusable, task-specific guidance across cooking, maintenance, troubleshooting, safety,
and future estate workflows. A resident can capture or upload a photo, explain what needs to be
done, review structured visual guidance, attach it to a task, and reopen the active guidance later.

The feature keeps the existing Baserow task contract unchanged. Guidance content and task bindings
are stored separately and versioned.

## Implemented

- Shared `GuidancePack` schema for procedures, recipes, checklists, troubleshooting, and safety.
- Separate `TaskGuidanceBinding` model for the active guidance version on a task.
- Recipe-to-guidance adapter so kitchen content can use the same viewer in future task links.
- Authenticated `POST /api/guidance/analyze` endpoint for photo analysis.
- Authenticated `GET /api/guidance?taskId=...` and `POST /api/guidance` endpoints.
- MongoDB persistence in production with JSON-backed non-production/test behavior.
- Existing authenticated upload API reused for source-photo storage, with production files and
  metadata kept under App Service's persistent `/home/hov-uploads` volume.
- Mobile-first photo capture and one-step-at-a-time instructions on every task card.
- Desktop split photo/instruction layout with mouse tooltips, materials, tools, warnings,
  visual cues, quality checks, and step navigation.
- Architecture record at `docs/05-project/task-guidance-architecture.md`.

## Sluice routing

Task guidance does not call Azure Foundry directly.

- Endpoint: `SLUICE_BASE_URL/v1/chat/completions`
- Policy alias: `cheap-long-context`
- Authentication: server-side `SLUICE_API_KEY` Bearer token
- Metadata:
  - `consumer=house-of-veritas`
  - `capability=task-guidance-vision`
  - `route_hint=cheap-long-context`
  - `stage`
  - `task_id`
- Direct-provider fallback: disabled

If Sluice is unconfigured, unreachable, or returns invalid guidance, the API returns an explicit
unavailable state. It does not generate demo instructions.

## Production configuration

Terraform configures:

- `SLUICE_BASE_URL=https://litellm.sluice.phoenixvc.tech`
- `SLUICE_GUIDANCE_MODEL=cheap-long-context`
- `SLUICE_API_KEY` as an App Service Key Vault reference

The remaining prerequisite is to provision a valid Sluice service virtual key in the HOV Key Vault:

```text
Vault: nl-prod-hov-kv
Secret name: sluice-api-key
```

Do not place the key in source, Terraform variables, PR comments, Baton, or browser-visible config.
Use the approved secret-management path.

## Validation evidence

Passed locally:

```text
terraform -chdir=terraform/environments/production validate
pnpm test tests/lib/guidance.test.ts tests/lib/sluice-guidance.test.ts tests/api/guidance.test.ts
pnpm run lint
pnpm run build
```

Results:

- Terraform configuration valid.
- Focused tests: 3 files, 8 tests passed.
- Full ESLint passed.
- Next.js production build passed and generated 122 pages/routes.

Passed on PR #129:

- Infrastructure Verification
- Terraform Plan
- Validate Configuration
- Lint
- Unit Tests
- Production Build
- E2E Tests
- Pipeline Summary

At handoff time, the PR is ready for review, mergeable with `CLEAN` status, and has no human review
comments.

## Runtime verification after merge

1. Provision `sluice-api-key` in `nl-prod-hov-kv`.
2. Deploy the merged application and Terraform App Service settings through the approved workflow.
3. Sign in as a resident with an assigned task.
4. Open the resident task page and select **Guidance** on a task.
5. Capture or choose a JPEG, PNG, or WebP photo under 10 MB.
6. Describe the desired result and constraints, then request visual guidance.
7. Confirm the guidance includes ordered steps, visible-evidence cues, completion checks, and
   appropriate stop warnings.
8. Review and attach the guidance to the task.
9. Close and reopen the dialog; confirm the active guidance and uploaded image persist.
10. Confirm Sluice and Docket telemetry contain the expected consumer, capability, stage, and task
    metadata without image data, descriptions, credentials, or other sensitive content.
11. Verify missing/invalid Sluice configuration produces an explicit unavailable state.

## Safety and residual risk

- AI guidance is advisory and requires resident review before attachment.
- Structural, electrical, gas, asbestos, work-at-height, and similarly hazardous uncertainty must
  produce a stop condition and qualified-person referral.
- The API is authenticated for all supported estate roles. Guidance is estate operational content;
  future task-level privacy requirements may require stricter per-task authorization.
- Browser/runtime verification is intentionally pending the Sluice virtual key and deployment.

## Next owner

The next owner should complete Baton task `1c26a6f4-684c-4f2d-92f5-746b9b4cf62b`: provision the
virtual key, deploy after PR #129 merges, run the runtime verification above, and record deployment,
browser, Sluice, and Docket evidence in Baton.
