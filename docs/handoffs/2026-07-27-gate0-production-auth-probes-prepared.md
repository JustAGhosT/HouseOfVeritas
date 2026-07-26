# Gate 0 production-auth probes prepared

- Date: 2026-07-27
- Repository: `C:\Users\smitj\repos\house-of-veritas`
- Branch: `agent/gate0-reviewer-testing-handoff`
- Baton project: `house-of-veritas` (`da62c803-1a03-45a4-9ce1-b6e86dd8d23d`)
- Reviewer acceptance task: `374f9f21-c76e-4547-a16e-b8238c26ddb1`
- Governance persistence task: `5445ec3b-386f-4624-b005-fd3d74ae3a13`

## Outcome

The production-auth Gate 0 Playwright coverage is prepared but was not executed
against production because legitimate short-lived admin and operator sessions
were unavailable. The checks remain `skipped`; no session was fabricated,
printed, stored, or added to Git or Baton.

The new manually invoked spec verifies:

1. admin access to the synthetic Domain Reviewer Lab;
2. fictional Variant B with all critical gates passing, all quality dimensions
   clear, and all fail-closed acknowledgements accepted;
3. the no-reliance result labels and reload-clears-result behavior;
4. admin read-only access to the Gate governance projection; and
5. operator page denial and HTTP 403 responses for both reviewer and governance
   surfaces.

The spec is intentionally absent from automatic deployment workflows. It needs
both legitimate roles at the same time and must not encourage long-lived
production session secrets.

The same scenarios can be replayed locally with synthetic Auth.js sessions by
running `pnpm run test:e2e:gate0`. Local sessions are generated in memory with
fictional `example.invalid` addresses and are never accepted in production
probe mode.

## Secure invocation boundary

Supply these values only through the approved short-lived process environment:

- `BASE_URL`;
- `POST_DEPLOY_PROBE=true`;
- `POST_DEPLOY_ADMIN_SESSION`;
- `POST_DEPLOY_OPERATOR_SESSION`; and
- optional role-specific cookie-name variables when the deployment does not use
  `__Secure-authjs.session-token`.

Do not place values on a command line, in shell history, logs, screenshots,
GitHub output, Baton, Git, or this document. Once the environment is prepared,
run:

```powershell
pnpm run test:e2e:post-deploy-gate0
```

Remove the process environment values immediately after the run.

## Explicitly still outstanding

This coverage performs no governance mutation. It therefore does not prove the
append-only governance write, reload, application restart, or post-restart
persistence required by task `5445ec3b-386f-4624-b005-fd3d74ae3a13`.

A production governance write changes durable owner-decision state, and an
application restart changes production runtime state. Both require an exact
approved test decision and explicit operational approval before execution. No
O5/O6 activation decision should be used merely as a persistence probe.

The following also remain prohibited without their private prerequisites and
separate approval: PIRB activity, candidate contact, real household evidence,
restricted records, payment, Terraform apply, Azure RBAC changes, O5/O6
activation, and Gate progression.

## Validation

Completed on 2026-07-27:

- `pnpm exec vitest run tests/lib/domain-safety-trial.test.ts tests/api/domain-safety-reviewer-trial.test.ts tests/components/domain-reviewer-lab-page.test.tsx tests/lib/nav-config.test.ts`
  passed 15/15;
- `pnpm run lint` passed;
- `pnpm exec tsc --noEmit` passed;
- `pnpm run build` passed and emitted both Gate 0 pages and APIs;
- the production-mode command with no session variables reported all six tests
  as skipped and made no authenticated request; and
- `pnpm run test:e2e:gate0` passed 6/6 against a local runtime with synthetic
  admin and operator sessions.

The first local browser replay passed five scenarios but hit the default
30-second timeout while creating the fifth test page. The spec now uses the
same 60-second authenticated-UI timeout established in `00-auth.spec.ts`; the
complete replay then passed 6/6. No source failure remained.
