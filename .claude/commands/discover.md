# Discover

Scan the codebase to build a comprehensive snapshot of the current project state. Updates the orchestrator state file.

## Instructions

1. Read `.claude/state/orchestrator.json` (or create from template if missing)

2. **Collect metrics:**
   - TypeScript errors: `pnpm exec tsc --noEmit 2>&1 | grep -c "error TS"`
   - Lint errors: `pnpm run lint 2>&1 | grep -c "error"`
   - Test results: `pnpm test 2>&1` (extract pass/fail counts)
   - TODO count: `grep -r -c "TODO" --include="*.ts" --include="*.tsx" | awk -F: '{s+=$NF}END{print s}'`
   - FIXME count: `grep -r -c "FIXME" --include="*.ts" --include="*.tsx" | awk -F: '{s+=$NF}END{print s}'`
   - Console.log count: `grep -r "console\." --include="*.ts" --include="*.tsx" | wc -l`
   - `any` type count: `grep -r ": any" --include="*.ts" --include="*.tsx" | wc -l`
   - API routes: count directories in `app/api/`
   - Components: count `.tsx` files in `components/`
   - Test files: count files in `tests/`

3. **Grade each team** (A-F based on metrics):
   - CI/CD: workflow count, last run status
   - Infrastructure: module count, security findings
   - Testing: coverage percentage, test count
   - API: route count, auth coverage
   - Database: persistence status, backup status
   - UI: page count, dead links
   - Architecture: in-memory store count
   - Refactoring: DRY violations, console.log count
   - Bugs: P0/P1 count from latest report
   - Vertical: features with complete coverage

4. **Write updated state** to `.claude/state/orchestrator.json`

5. **Report summary** to the user with health grades and recommended next action.
