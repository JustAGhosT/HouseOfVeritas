# Post-deployment API probes handoff

## Status

Completed and deployed to production on 2026-07-24.

- PR: [#126](https://github.com/neuralliquid/house-of-veritas/pull/126)
- Merge commit: `048bddf4b3dd561a4f0febc6e982458cc766e408`
- Production deployment: [run 30098162462](https://github.com/neuralliquid/house-of-veritas/actions/runs/30098162462)
- Baton implementation task: `aeed0e82-d0a5-49bc-8a8e-637f81fdaf98`
- Baton deployment verification: `4bbeb0d5-fd4d-453e-a9a2-628a1c3bcf0d`

## What shipped

- `tests/e2e/05-post-deploy-api-probes.spec.ts` adds authenticated, read-only Playwright probes for:
  - `GET /api/projects?type=scope`
  - resolving management-user IDs returned by `GET /api/users`
- `.github/workflows/deploy-on-merge.yml` and `.github/workflows/deploy.yml` run the probe after web deployment as an advisory job.
- `playwright.config.ts` does not start a local server when the probe targets an already deployed `BASE_URL`.

The probe never sends PATCH, POST, PUT, or DELETE requests. It does not block a deployment.

## Production evidence

- Deployment run `30098162462` completed successfully.
- `Deploy Web App` succeeded.
- `Optional Post-Deployment API Probes` completed successfully but skipped because `POST_DEPLOY_ADMIN_SESSION` is unset.
- `https://hov.neuralliquid.ai/api/health` returned HTTP 200 with `status: healthy` and `dataMode: empty`.

## Required configuration

To enable the authenticated probe on the next deployment, set the production environment secret:

```text
POST_DEPLOY_ADMIN_SESSION=<short-lived Auth.js admin session token>
```

Optional production variable:

```text
POST_DEPLOY_ADMIN_SESSION_COOKIE_NAME=__Secure-authjs.session-token
```

The session token must be renewed before it expires. Do not use a long-lived user session or add a mutation to the probe.

## Next action

1. Provision a short-lived production admin session in `POST_DEPLOY_ADMIN_SESSION`.
2. On the next web deployment, confirm `Optional Post-Deployment API Probes` executes rather than skips.
3. Investigate any non-200 scope response or user ID resolution failure as a production configuration/data issue.
