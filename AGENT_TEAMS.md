# Agent Teams

Team-based organization of the HouseOfVeritas agent system.

## Team Structure

### Platform Team

Agents responsible for the core platform infrastructure.

| Agent                | Focus                              | Command                 |
| -------------------- | ---------------------------------- | ----------------------- |
| `veritas-pipeline`   | GitHub Actions, pipelines, secrets | `assess-cicd`           |
| `veritas-foundation` | Terraform, Azure, security         | `assess-infrastructure` |

### Application Team

Agents responsible for the application layer.

| Agent             | Focus                         | Command           |
| ----------------- | ----------------------------- | ----------------- |
| `veritas-gateway` | Routes, Azure Functions       | `assess-api`      |
| `veritas-vault`   | Data layer, storage, models   | `assess-database` |
| `veritas-surface` | Components, accessibility, UX | `assess-ui`       |

### Quality Team

Agents responsible for code quality and testing.

| Agent              | Focus                         | Command              |
| ------------------ | ----------------------------- | -------------------- |
| `veritas-lab`      | Coverage, quality, frameworks | `assess-testing`     |
| `veritas-refinery` | SOLID, DRY, code smells       | `assess-refactoring` |
| `veritas-radar`    | Bug detection, feature gaps   | `assess-bugs`        |

### Architecture Team

Agents responsible for system-wide concerns.

| Agent               | Focus                                | Command               |
| ------------------- | ------------------------------------ | --------------------- |
| `veritas-blueprint` | System design, patterns, scalability | `assess-architecture` |
| `veritas-journey`   | Cross-stack feature completeness     | `assess-vertical`     |

### Orchestrator

| Agent           | Focus                              | Command      |
| --------------- | ---------------------------------- | ------------ |
| `veritas-orbit` | Dispatches all agents, synthesizes | `assess-all` |

### Operational Subagents

Operational subagents handle live work around the assessment backbone. The names use
a current Veritas module theme rather than numbered files or medieval titles.

| Priority | Subagent          | Focus                                                 | Based on                                     |
| -------- | ----------------- | ----------------------------------------------------- | -------------------------------------------- |
| P0       | `veritas-nexus`   | Coordination, Baton, sequencing, handoffs             | Mystira seneschal, Retort shipper            |
| P0       | `veritas-shield`  | Auth, RBAC, PII, POPIA, secrets, webhooks, uploads    | Mystira guardian, Retort security            |
| P0       | `veritas-proof`   | Vitest, API route tests, Playwright, quality gates    | Mystira artificer, Retort test lead          |
| P1       | `veritas-atlas`   | Read-only code exploration and blast-radius maps      | Mystira pathfinder                           |
| P1       | `veritas-beacon`  | Runtime diagnostics, health, env drift, deploy checks | Mystira watchman, Retort environment manager |
| P1       | `veritas-archive` | Docs, ADRs, history notes, durable agent lessons      | Mystira scribe/keeper, Retort retrospective  |
| P1       | `veritas-studio`  | UI polish, accessibility, responsive checks           | UI/design review practice                    |
| P1       | `veritas-launch`  | Release readiness, CI/CD, rollback planning           | Retort release discipline                    |
| P1       | `veritas-ledger`  | Data/integration implementation validation            | Data-layer assessment practice               |
| P1       | `veritas-compass` | Product workflows, backlog shape, PRD clarity         | Product/vertical feature practice            |

## Execution Model

1. **Individual assessment:** Run a single agent's command for focused analysis
2. **Team assessment:** Run all agents in a team for domain-specific audit
3. **Full assessment:** Run `veritas-orbit` to dispatch all 10 assessment agents and synthesize
4. **Fix mode:** Read a report and fix identified issues

## Specialist Routing Rules

Borrowing the strongest practice from Mystira and Retort, use team ownership before broad edits:

- **Security/auth changes:** involve `veritas-shield`, `veritas-gateway`, and `veritas-blueprint`, then validate against `.claude/rules/security.md`.
- **Data or seed/fallback behavior:** involve `veritas-ledger`, `veritas-vault`, and `veritas-gateway`; verify empty-state and configured-integration behavior.
- **Dashboard/navigation/UI changes:** involve `veritas-surface` and `veritas-studio`; browser-check affected routes when practical.
- **CI/CD or deployment changes:** involve `veritas-pipeline`, `veritas-foundation`, `veritas-launch`, and `veritas-beacon`; verify pipeline command names and package manager.
- **Cross-stack features:** involve `veritas-journey` and `veritas-compass` after implementation to confirm the user workflow works end to end.
- **Non-trivial implementation:** `veritas-proof` owns the verification plan; `veritas-radar` owns regression risk.

## Handoff Standard

When handing work to another agent or a human, include:

- Baton project/task ID
- Repo path and branch
- Changed files
- What was implemented and why
- Commands run and exact pass/fail/warnings
- Manual/browser checks still needed
- Next owner and next action

## State Tracking

Orchestrator state persists in `.claude/state/orchestrator.json` across sessions.
Template at `.claude/state/orchestrator.json.template`.
