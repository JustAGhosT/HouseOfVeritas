# Brace Expansion CVE Remediation

## Scope

- Baton task: `de6dac5d-116a-4bea-8333-9a1dadc042ae`
- Advisory: `GHSA-mh99-v99m-4gvg` / `CVE-2026-14257`
- Affected paths: ESLint tooling through `minimatch` 3.1.5 and 9.0.9

## Decision

Resolve both transitive `brace-expansion` ranges to 5.0.8, the first patched
release. Keep the consumer versions selected by the current ESLint and
TypeScript-ESLint toolchain, and use pnpm patches to adapt their legacy
callable/default imports to the named `expand` export introduced by
`brace-expansion` 5.

A direct `brace-expansion` override without the consumer patches is unsafe:
both minimatch generations would load an undefined or non-callable export.
Forcing minimatch 10 would also cross an unsupported major-version boundary for
the current ESLint plugin set.

## Verification

Run from the repository root:

```text
pnpm install --frozen-lockfile
pnpm audit --json
pnpm run lint
pnpm test
pnpm run build
```

The remediation was additionally checked with direct brace expansion calls
through both installed minimatch generations. The live audit returned zero
vulnerabilities, lint passed, all 351 tests passed, and the production build
completed successfully.

## Maintenance

Remove the compatibility patches once the repository's supported ESLint plugin
set no longer resolves minimatch versions that expect the legacy
`brace-expansion` export shape. Until then, keep the patches and the 5.0.8
overrides together.
