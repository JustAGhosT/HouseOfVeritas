# CLAUDE.md

Project context for Claude Code / Cursor AI sessions.

## Project

**House of Veritas** — Estate management platform for residential property operations. Built with Next.js 16, deployed to Azure.

- **Repository:** `C:\Users\smitj\repos\house-of-veritas`
- **Baton project:** `house-of-veritas` (`da62c803-1a03-45a4-9ce1-b6e86dd8d23d`)
- **Default branch:** `main`
- **Package manager:** pnpm 10.x (`packageManager` is pinned in `package.json`)

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** Next.js API routes, Azure Functions (Python)
- **Database:** Baserow (operational), PostgreSQL (DocuSeal/Baserow backend), MongoDB (kiosk)
- **Infrastructure:** Terraform (Azure), Docker, GitHub Actions CI/CD
- **Integrations:** DocuSeal (e-signatures), Baserow (data), Azure Communication Services (email), Twilio (SMS)

## Key Commands

```bash
pnpm install              # Install dependencies
pnpm run dev              # Start dev server (port 3000)
pnpm run build            # Production build
pnpm run lint             # ESLint check
pnpm test                 # Run unit tests (Vitest)
pnpm run test:e2e         # Run E2E tests (Playwright)
pnpm run test:coverage    # Coverage report
pnpm exec tsc --noEmit    # Type check
```

## Architecture

```text
app/                      # Next.js pages and API routes
  api/                    # API endpoints
  dashboard/              # Per-user dashboards (hans, charl, lucky, irma)
  login/, kiosk/          # Public pages
lib/                      # Shared libraries
  auth/                   # JWT, RBAC, rate limiting
  services/               # Baserow, DocuSeal, notifications, marketplace
components/               # React components
config/azure-functions/   # Python Azure Functions
terraform/                # IaC modules
tests/                    # Unit (Vitest) + E2E (Playwright)
.claude/                  # Agent system, hooks, rules, state
```

## Users (Personas)

| ID    | Role     | Dashboard                               |
| ----- | -------- | --------------------------------------- |
| hans  | admin    | Full estate oversight, payroll, reports |
| charl | operator | Workshop, vehicles, time clock          |
| lucky | operator | Garden, expenses, inventory             |
| irma  | resident | Household, meal planning, documents     |

## Agent System

See `AGENTS.md` for the multi-agent assessment framework. Key commands:

- Individual: `Read .claude/commands/assess-{domain}.md`
- Full audit: `Read .claude/commands/assess-all.md`
- Reports: `.claude/reports/` (gitignored)
- Subagent strategy: `docs/05-project/agent-subagent-strategy.md`

## Agent Operating Model

Lessons folded in from Mystira and Retort:

- Start meaningful work by checking the `house-of-veritas` Baton project for existing tasks or handoffs.
- Use the specialist domains in `AGENT_TEAMS.md` before making broad changes; escalate security/auth, infrastructure, data, and UI work to their domain rules.
- Keep diffs focused. Do not combine unrelated refactors with product fixes.
- For UI behavior changes, run lint/build and use browser verification when the change affects navigation, layout, forms, or empty states.
- For non-trivial bugs/features, leave a handoff or history note with changed files, root cause, verification, and next owner.
- Prefer clean-slate production behavior. Demo data must be opt-in via environment flags, not implicit development behavior.

## Data Mode

The app should start empty unless real integrations or explicit demo flags are configured.

- `ALLOW_DEMO_DATA=true` enables local fallback/demo operational data.
- `ALLOW_DEMO_USERS=true` enables extra demo auth users.
- Without those flags, unconfigured integrations should return empty data and should not show a "Demo Mode" badge.

## Rules

- Security: `.claude/rules/security.md`
- Testing: `.claude/rules/testing.md`
- TypeScript: `.claude/rules/typescript.md`
- Next.js: `.claude/rules/nextjs.md`
- Infrastructure: `.claude/rules/infrastructure.md`

## Hooks

Lifecycle hooks in `.claude/hooks/`:

- `session-start.sh` — Verify environment and build state
- `protect-sensitive.sh` — Block writes to .env, .tfvars, credentials
- `guard-destructive-bash.sh` — Block force-push, hard reset, terraform destroy
- `warn-uncommitted.sh` — Warn when 10+ uncommitted files
- `stop-build-check.sh` — Verify TypeScript and tests pass before finishing

## Current State

Run `/assess-all` for latest metrics. See `.claude/reports/orchestrator-summary.md` for prioritized backlog.

## Baton Integration

Baton is the shared task graph for cross-repo work. Use the `house-of-veritas` project, not the generic `baton` project:

- Project name: `house-of-veritas`
- Project ID: `da62c803-1a03-45a4-9ce1-b6e86dd8d23d`

When the `baton` MCP server is available, agents should check for existing work with `task_check` / `search_tasks` at the start of meaningful tasks, create or claim visible work with `task_notify` / `create_task`, update the task when significant new information becomes available, and log completion or blockers before handing off. If a task is accidentally created in the wrong project, recreate it in `house-of-veritas` and mark the misplaced copy done.
