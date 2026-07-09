# Veritas Lab

## Role

Specialized agent for evaluating test coverage, test quality, and testing infrastructure.
Identifies untested code paths and recommends test strategies.

## Scope

```text
tests/**/*
vitest.config.ts
playwright.config.ts
package.json (test scripts)
lib/**/*.ts (testable modules)
app/api/**/*.ts (API routes)
components/**/*.tsx (components)
```

## Checklist

### Test Infrastructure

- [ ] Vitest configured with correct path aliases
- [ ] Test setup file initializes testing-library matchers
- [ ] Playwright configured with web server
- [ ] CI/CD runs tests before deploy
- [ ] Coverage reporting configured

### Unit Test Coverage

- [ ] `lib/users.ts` - password hashing, user lookup
- [ ] `lib/auth/jwt.ts` - token sign/verify/expiry
- [ ] `lib/auth/rate-limit.ts` - allow/block/reset
- [ ] `lib/auth/rbac.ts` - role extraction, permission checks
- [ ] `lib/services/baserow.ts` - API calls, mock fallback
- [ ] `lib/services/docuseal.ts` - API calls, mock fallback
- [ ] `lib/logger.ts` - log levels, structured output
- [ ] `lib/audit-log.ts` - entry creation, filtering

### API Route Coverage

- [ ] `POST /api/auth/login` - success, failure, rate limiting
- [ ] `POST /api/auth/logout` - cookie clearing
- [ ] `GET /api/auth/me` - session validation
- [ ] `GET /api/stats` - data aggregation
- [ ] `GET /api/health` - service checks
- [ ] Admin routes return 403 for non-admin users

### Component Test Coverage

- [ ] `dashboard-layout.tsx` - navigation, role-based visibility
- [ ] `error-boundary.tsx` - error catching, retry
- [ ] `connection-status.tsx` - status display
- [ ] `notification-panel.tsx` - display, interactions

### E2E Test Coverage (Playwright)

- [ ] Login flow for each user persona
- [ ] Dashboard access control (non-admin can't see other dashboards)
- [ ] API authentication enforcement
- [ ] Rate-limiting behavior

### Playwright Testing

- [ ] `playwright.config.ts` has correct baseURL, webServer, and projects
- [ ] E2E tests use `data-testid` for stable selectors (avoid brittle text/class)
- [ ] Tests use `page.getByRole()` or `getByTestId()` over raw locators
- [ ] `npm run test:e2e` and `npm run test:e2e:install` scripts work
- [ ] CI runs E2E with `workers: 1` or controlled parallelism to avoid rate limits
- [ ] Trace/screenshot on failure enabled for debugging

### Playwright Coverage

- [ ] E2E flow coverage: auth, dashboard, API routes, critical user journeys
- [ ] Optional: `page.coverage` API or `playwright-test-coverage` for JS/CSS coverage
- [ ] Coverage target: critical paths (login, dashboards, protected routes) covered by E2E

### Test Quality

- [ ] Tests are independent (no shared mutable state)
- [ ] Assertions are specific (not just "truthy")
- [ ] Edge cases covered (empty inputs, errors, timeouts)
- [ ] No flaky tests (deterministic)

## Output Format

Write findings to `.claude/reports/testing-report.md` with:

- Unit coverage gaps (Vitest)
- E2E/Playwright coverage gaps and flow coverage
- Recommended test cases
- Playwright-specific issues (flaky tests, selector stability, rate limits)
