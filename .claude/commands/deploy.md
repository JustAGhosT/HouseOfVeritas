# Deploy Checklist

Pre-deployment verification checklist. Run this before deploying to production.

## Instructions

### Phase 1: Code Quality

1. Run `pnpm exec tsc --noEmit` — must pass with 0 errors
2. Run `pnpm run lint` — must pass with 0 errors
3. Run `pnpm test` — all tests must pass
4. Run `pnpm run build` — must succeed
5. Check for `console.log` in production code paths

### Phase 2: Security

1. Verify `JWT_SECRET` is set in environment (not using fallback)
2. Verify no `demoPassword` in auth responses
3. Verify all API routes have auth checks (except PUBLIC_PATHS)
4. Run `pnpm audit` — no critical vulnerabilities
5. Verify `.env.local` is gitignored

### Phase 3: Infrastructure

1. Run `terraform fmt -check -recursive` in `terraform/`
2. Run `terraform validate` in `terraform/environments/production/`
3. Verify all GitHub secrets are documented
4. Verify health check endpoints work

### Phase 4: Pre-Deploy

1. Verify `package-lock.json` is committed
2. Check git status is clean
3. Verify correct branch (main)
4. Review deployment workflow inputs

### Output

Write a deployment readiness report with PASS/FAIL for each check.
If any critical check fails, recommend blocking deployment.
