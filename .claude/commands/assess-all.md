# Full Team Assessment (Orchestrator)

Read the orchestrator definition at `.claude/agents/veritas-orbit.md` and execute the complete multi-agent assessment.

## Instructions

### Phase 1: Dispatch All Agents

Run each agent assessment by reading its definition and executing its checklist:

1. Read and execute `.claude/commands/assess-cicd.md`
2. Read and execute `.claude/commands/assess-infrastructure.md`
3. Read and execute `.claude/commands/assess-testing.md`
4. Read and execute `.claude/commands/assess-api.md`
5. Read and execute `.claude/commands/assess-database.md`
6. Read and execute `.claude/commands/assess-ui.md`
7. Read and execute `.claude/commands/assess-architecture.md`
8. Read and execute `.claude/commands/assess-refactoring.md`
9. Read and execute `.claude/commands/assess-bugs.md`
10. Read and execute `.claude/commands/assess-vertical.md`

Run as many concurrently as possible (up to 4 at a time).

### Phase 2: Collect Reports

After all agents complete, read all reports from `.claude/reports/`.

### Phase 3: Synthesize

Identify cross-cutting themes, dependency chains, and risk clusters.

### Phase 4: Prioritize

Create a unified action plan:

- **P0 (Critical)**: Security vulnerabilities, data loss risks, broken deploys
- **P1 (High)**: Missing core features, failing tests, infra gaps
- **P2 (Medium)**: Code quality, performance, DX improvements
- **P3 (Low)**: Nice-to-haves, polish, future enhancements

### Phase 5: Master Report

Write the unified assessment to `.claude/reports/orchestrator-summary.md` with:

- Overall health scores (A-F) per domain
- Critical findings requiring immediate action
- Prioritized action backlog with effort estimates
- Cross-cutting concerns
- Links to individual agent reports

Return the master summary to the user.
