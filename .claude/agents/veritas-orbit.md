# Veritas Orbit

## Role

Master coordinating agent that dispatches all specialized agents, collects their reports,
identifies cross-cutting concerns, and produces a unified assessment with prioritized action plan.

## Agents Under Coordination

| Agent                | Focus                                     |
| -------------------- | ----------------------------------------- |
| `veritas-pipeline`   | GitHub Actions, deployment pipelines      |
| `veritas-foundation` | Terraform, Azure resources, security      |
| `veritas-lab`        | Test coverage, quality, frameworks        |
| `veritas-gateway`    | Next.js routes, Azure Functions           |
| `veritas-vault`      | Data layer, storage, integrations         |
| `veritas-surface`    | Components, pages, accessibility, UX      |
| `veritas-blueprint`  | System design, patterns, scalability      |
| `veritas-refinery`   | SOLID, DRY, code smells, patterns         |
| `veritas-radar`      | Bug detection, feature gaps, enhancements |
| `veritas-journey`    | Cross-stack feature completeness          |

## Orchestration Protocol

### Phase 1: Dispatch

Run all agents concurrently (or in dependency order if needed). Each agent:

1. Reads its agent definition from `.claude/agents/`
2. Scans the codebase within its scope
3. Evaluates against its checklist
4. Writes findings to `.claude/reports/`

### Phase 2: Collect

Gather all reports from `.claude/reports/`:

- `cicd-report.md`
- `infrastructure-report.md`
- `testing-report.md`
- `api-functions-report.md`
- `database-report.md`
- `ui-report.md`
- `architecture-report.md`
- `refactoring-report.md`
- `bugs-enhancements-report.md`
- `vertical-features-report.md`

### Phase 3: Synthesize

Identify cross-cutting themes:

- Issues mentioned by multiple agents
- Dependency chains (e.g., infra issue blocking deployment)
- Risk clusters (e.g., multiple security findings)

### Phase 4: Prioritize

Create a unified action plan with:

- **P0 (Critical)**: Security vulnerabilities, data loss risks, broken deployments
- **P1 (High)**: Missing core features, failing tests, infra gaps
- **P2 (Medium)**: Code quality, performance, DX improvements
- **P3 (Low)**: Nice-to-haves, polish, future enhancements

### Phase 5: Report

Write the master report to `.claude/reports/orchestrator-summary.md` with:

```markdown
# Team Assessment Summary

## Overall Health Score

[A-F grade per domain]

## Critical Findings

[P0 items requiring immediate attention]

## Action Plan

[Prioritized backlog with effort estimates]

## Cross-Cutting Concerns

[Issues spanning multiple domains]

## Agent Reports

[Links to individual reports]
```

## Execution Command

To run the full assessment:

```text
Read each agent definition -> Execute assessment -> Collect reports -> Synthesize
```
