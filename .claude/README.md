# Claude Agent System

Multi-agent assessment framework with lifecycle hooks, persistent state, and domain-specific rules.

## Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                    LIFECYCLE HOOKS                        │
│  SessionStart → PreToolUse → PostToolUse → Stop          │
│  (env check)    (protect)    (warn)        (build check) │
└──────────────────────────────────────────────────────────┘
         │                                      │
         ▼                                      ▼
┌──────────────────────┐          ┌──────────────────────┐
│    DOMAIN RULES      │          │     PERMISSIONS      │
│  security.md         │          │    settings.json     │
│  testing.md          │          │  allow/deny lists    │
│  typescript.md       │          │  env variables       │
│  nextjs.md           │          └──────────────────────┘
│  infrastructure.md   │
└──────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│         VERITAS ORBIT           │
│     (veritas-orbit.md)          │
│  Dispatches, collects, ranks    │
└──────────┬──────────────────────┘
           │
    ┌──────┼──────────────────────────────────────────┐
    │      │      │      │      │      │      │       │
    ▼      ▼      ▼      ▼      ▼      ▼      ▼       ▼
┌────────┐┌────────┐┌──────┐┌────────┐┌──────┐┌────────┐┌────────┐┌────────┐
│Pipeline││Foundation││Lab ││Gateway ││Vault ││Surface ││Blueprint││Refinery│
└────────┘└────────┘└──────┘└────────┘└──────┘└────────┘└────────┘└────────┘
    │      │      │      │      │      │      │       │
    ▼      ▼      ▼      ▼      ▼      ▼      ▼       ▼
┌──────────────────────────────────────────────────────────────┐
│              PERSISTENT STATE + REPORTS                       │
│   .claude/state/orchestrator.json   .claude/reports/*.md     │
└──────────────────────────────────────────────────────────────┘
         ▲              ▲
         │              │
    ┌──────┐       ┌────────┐
    │Radar │       │Journey │
    └──────┘       └────────┘
```

## Components

### Agents (10 + orchestrator)

Specialized assessors that scan specific domains of the codebase.
Each has a role, scope (file patterns), and checklist.

### Commands (17 total)

Executable prompts: 11 assessment commands + 6 operational commands
(healthcheck, fix, discover, deploy, review-pr, security-audit).

Commands should use `pnpm` for JavaScript/TypeScript work in this repo.

### Hooks (5 lifecycle scripts)

Automated safety checks triggered during Claude Code sessions:

- **SessionStart**: Verify environment, install deps, run build check
- **PreToolUse (Write|Edit)**: Block writes to sensitive files
- **PreToolUse (Bash)**: Block destructive commands
- **PostToolUse (Write|Edit)**: Warn about uncommitted changes
- **Stop**: Verify TypeScript and tests still pass

### Rules (5 domain files)

Project-specific coding standards agents follow during fixes.

### State

Persistent orchestrator state that survives across sessions.
Updated by `discover` and `assess-all` commands.

### Permissions

`settings.json` whitelists safe commands and blocks destructive ones.

## Baton Project

House of Veritas work belongs in Baton project `house-of-veritas`
(`da62c803-1a03-45a4-9ce1-b6e86dd8d23d`). Do not create House of Veritas tasks
under the generic `baton` project. If that happens, recreate the task in the
correct project and close the misplaced copy.

## Adopted Agent Practices

From Mystira and Retort, this system should preserve:

- explicit project/task ownership before implementation,
- focused specialist routing by domain,
- quality gates before handoff,
- traceable handoffs with changed files and verification,
- opt-in demo data only.
