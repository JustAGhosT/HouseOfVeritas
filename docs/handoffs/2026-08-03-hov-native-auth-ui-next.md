# HOV-native authentication UI next slice

Status: explored and ready for implementation handoff

## Baton

- Project: `house-of-veritas` (`da62c803-1a03-45a4-9ce1-b6e86dd8d23d`)
- Task: `ef16094d-6584-4924-b25d-49b36dd90804`
- Title: Move HOV login and registration UI onto HOV domain

## Goal

Make the complete interactive authentication experience look and read like
House of Veritas on the dedicated HOV login hostname, while Mystira Identity
remains the only authority for email ownership, antiforgery, rate limiting,
magic-link issuance and consumption, Microsoft federation, DOB classification,
age policy, Identity sessions, authorization codes, and tokens.

The desired browser journey is:

1. `hov.neuralliquid.ai/login` starts Auth.js OIDC with PKCE and state.
2. The authorization hop stays on `login.hov.neuralliquid.ai` and presents a
   House of Veritas visual/copy profile.
3. Email-link, Microsoft, registration/DOB, error, and check-email states retain
   that same profile.
4. Identity resumes the validated local `/connect/authorize` request and returns
   an authorization code to HOV's Auth.js callback.

## Current state and evidence

- HOV `origin/main` is `6713f633` after PR #169.
- PR #168 already separated the browser-facing authorization endpoint from the
  canonical issuer and deployed
  `https://login.hov.neuralliquid.ai/connect/authorize`.
- The live custom-domain discovery document responds successfully. Its issuer is
  still `https://mys-dev-id-webapi.azurewebsites.net/`; the authorization and
  end-session endpoints use `login.hov.neuralliquid.ai`.
- HOV's `/login` page is branded but is currently only a launcher labelled
  `Continue with Mystira`.
- Mystira's `LoginPageHtml` renders the actual email, Microsoft, DOB,
  check-email, and error screens with a generic shell and Mystira attribution.
  Only the initial login heading is client-aware; later screens do not retain an
  application visual profile.
- Legitimate production Microsoft/OIDC acceptance passed for the mapped Lucky
  identity: `/dashboard/lucky` survived a full reload and `/api/auth/me`
  returned 200. This does not prove the custom-domain magic-link path.
- There are no open HOV pull requests. The old
  `C:\tmp\hov-native-auth` worktree contains the already-merged PR #168 commits
  plus an untracked Playwright directory; preserve it until cleanup is explicitly
  authorized.

## Security and ownership decision

Do not move the email, magic-token, Microsoft callback, or DOB forms into the
HOV Next.js relying party. Doing so would create a second handler for sensitive
identity state, expand the PII/session boundary, and make it harder to preserve
Identity's antiforgery, uniform-response, rate-limit, one-time-token, and
server-authoritative age guarantees.

Instead, treat `login.hov.neuralliquid.ai` as the HOV-owned experience boundary
and Mystira Identity as the execution boundary. Select the HOV presentation from
trusted server context only:

- the exact allowlisted custom host for continuation pages; and
- the data-protected, ReturnUrl-bound OIDC client context where a client identity
  is required.

Never select branding from an arbitrary `brand`, `tenant`, `returnUrl`, or other
untrusted query value. Never log email, DOB, token, authorize query strings, or
Identity/HOV session material.

## Smallest implementation slice

Primary owner: Mystira Identity, with a focused HOV copy/test follow-up.

1. Add a typed interactive-login presentation profile in Mystira Identity. The
   first profile is House of Veritas and is selected only for the exact
   `login.hov.neuralliquid.ai` host. Unknown hosts keep the neutral Mystira
   profile.
2. Refactor `LoginPageHtml` so its shell and every state accept the resolved
   profile: login, check-email, adult magic registration, Entra DOB registration,
   and error/retry pages.
3. Keep all assets local or inline under the strict CSP. Use encoded text,
   allowlisted colour/token values, visible focus treatment, accessible labels,
   and mobile-sized controls. Do not load third-party fonts, scripts, analytics,
   or images from the login page.
4. Preserve the existing protected `InteractiveLoginBrandingContext` for the
   validated application display name. Do not replace it with host or query
   parsing for client identity.
5. Update HOV `/login` copy so it describes a secure continuation to House of
   Veritas sign-in without suggesting that Mystira access alone grants estate
   access. Do not add an email or DOB form to HOV.
6. Keep issuer, discovery/JWKS trust, Auth.js callback, PKCE/state checks,
   adult-only client policy, and federated logout semantics unchanged.

Likely Mystira files:

- `apps/identity/src/Mystira.Identity.Api/Oidc/InteractiveLogin/LoginPageHtml.cs`
- `apps/identity/src/Mystira.Identity.Api/Oidc/InteractiveLogin/InteractiveLoginEndpoints.cs`
- a new typed resolver/profile beside those files
- `apps/identity/tests/Mystira.Identity.Api.Tests/Oidc/InteractiveLogin/InteractiveLoginEndpointsHttpTests.cs`
- focused profile/resolver tests

Likely HOV files:

- `app/login/page.tsx`
- login-focused unit/E2E coverage
- this handoff after implementation evidence is available

## Required tests

Mystira Identity:

- Exact HOV host selects the HOV profile; unknown or forged hosts do not.
- Every rendered state uses the selected profile and continues to HTML-encode all
  dynamic values.
- Invalid/missing ReturnUrl still fails before rendering or dispatch.
- Magic-link request responses remain uniform for known, unknown, failed, and
  rate-limited addresses.
- Antiforgery, return-URL pinning, token non-consumption on invalid flows, session
  fixation protections, and server-side age decisions remain unchanged.
- No email, DOB, token, ReturnUrl, client ID, or hashes are added to browser logs
  or telemetry beyond the existing privacy-safe event contract.

HOV:

- `pnpm run lint`
- focused auth/login tests
- `pnpm run build`
- browser verification that `/login` starts OIDC at the HOV custom domain and
  preserves a safe local callback target

## Deployment and acceptance gates

1. Merge and deploy the Mystira Identity presentation change first.
2. Verify the custom hostname, certificate, `/connect/authorize`, and
   `/connect/endsession` without changing issuer or token trust.
3. Merge/deploy any HOV launcher-copy change.
4. With explicit operator participation, capture two legitimate flows with
   retries disabled and tracing off:
   - an existing-account Microsoft sign-in; and
   - a magic-link flow, including the DOB screen only when Identity legitimately
     requires first-time adult registration.
5. Confirm return to the correct HOV persona, `/api/auth/me` 200, persistence
   after reload, and logout followed by a protected-route challenge.

Deployment health and synthetic probes are not authentic acceptance. Do not
fabricate a DOB, create or merge identities by display name, paste session
material into automation, or weaken the adult-only HOV client policy.

## Next action

Start from clean worktrees at the current Mystira `origin/dev` and HOV
`origin/main`. Recheck both repositories, the Baton task, open PRs, and the live
custom-domain discovery document before editing. Implement the Mystira typed
presentation profile and its focused HTTP tests as the first PR; keep the HOV
launcher change separate unless it is required for an end-to-end test.
