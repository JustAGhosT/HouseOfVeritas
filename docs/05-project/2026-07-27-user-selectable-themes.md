# User-selectable workspace themes

## Decision

Workspace colour is a personal preference, not a role or permission signal. Users can choose a
theme during onboarding and change it later in Settings without changing dashboard ownership,
navigation, responsibilities, or RBAC.

## Implementation

- Five named, accessible dark-first palettes are defined in `lib/user-themes.ts`.
- The selected `theme_id` is stored on the existing user record and validated at the authenticated
  `/api/users/me` boundary.
- Existing users without `theme_id` retain their former persona palette through the legacy `color`
  mapping; new self-provisioned users start with Sanctum Gold until they choose.
- `data-user-theme` on the document root drives semantic CSS variables. Dashboard home pages and the
  shared navigation shell consume `primary`/`secondary` tokens instead of persona-specific dominant
  colours.
- Operational meaning remains colour-stable: destructive, warning, success, and data-series colours
  are not rewritten as personal accents.

## Verification

- `pnpm exec tsc --noEmit`
- `pnpm run lint`
- `pnpm run build`
- `pnpm test -- tests/lib/user-themes.test.ts tests/api/user-theme.test.ts`

The complete unit suite currently has a pre-existing two-test failure in
`tests/lib/deployment-workflow-contract.test.ts`: its deploy-job substring includes later workflow
jobs and therefore sees their valid `actions/checkout` steps. The theming tests and the other 413
tests pass.
