# Defensible NOAT: positioning and competitive-analysis handoff

Date: 2026-07-25  
Baton task: `96cc20be-1cb4-4dd9-85cc-cd9790b06148`  
Repository: `C:\Users\smitj\repos\house-of-veritas`

## Intake

Goal: determine what House of Veritas should build, in evidence-gated phases, to create a defensible NOAT. Start with positioning and competitors before recommending implementation.

Kickoff question: confirm whether **NOAT** is intentional terminology or means **moat**. Preserve the user's term until confirmed.

Risk tier: product strategy and research. No production, auth, data, secret, or deployment changes are authorized by this handoff.

Affected domains: product strategy, market research, customer discovery, commercial validation, trust/security, data strategy, and phased delivery planning.

Assumptions:

- The next session will use fresh web research and date every material claim.
- Primary sources should anchor competitor capabilities, pricing, positioning, and customer claims.
- Current product behavior is evidence, not proof of product-market fit or defensibility.
- A feature list is not a moat. Each claimed advantage needs a mechanism, evidence, and a test that could disprove it.

## Current product baseline

As of this handoff:

- Production health returns HTTP 200 with `status=healthy` and `dataMode=empty`.
- Authenticated task creation and reload persist through the existing Cosmos Mongo integration when Baserow is unconfigured.
- Task-specific visual guidance can call Sluice, return safety-bounded steps, attach to a task, and reopen from persistent storage.
- The completed production proof used a legitimate Mystira session mapped to Hans/admin on the Irma resident surface.
- A genuine `role=resident` authorization proof still requires a legitimate resident-mapped Mystira identity; Baton `7bbf0537-ba6f-478a-9afd-f0c0a748e7ff`.
- OneDeploy has repeatedly needed a manual App Service restart to activate the new worker; Baton `3f6a9c76-8edd-4b51-938c-dfa9fc2ed07d`.
- Credential rotation and Sluice log redaction require an explicit owner decision; Baton `958ccd6a-3f7b-4034-ab43-174d00dbc9c8`.

Relevant implementation history:

- PR #129: task visual-guidance foundation.
- PRs #130-#135: Cosmos-backed task persistence, compatibility/index fixes, and individual task lookup for guidance.
- Final deployment: <https://github.com/neuralliquid/house-of-veritas/actions/runs/30135673035>
- Final deployment checklist: <https://github.com/neuralliquid/house-of-veritas/actions/runs/30135673045>

## Phase 0: positioning and competitors

Do this before proposing a roadmap.

### Questions to answer

1. Who is the narrowest high-value initial customer?
2. Who buys, administers, contributes data, performs work, and receives value?
3. What urgent job is being done today, and what is the cost of the current workaround?
4. What category does the buyer use when searching or budgeting?
5. Which products are direct competitors, adjacent competitors, substitutes, or "do nothing" alternatives?
6. Which HOV claims are already supported by shipped evidence, and which remain hypotheses?
7. What wedge can win without requiring the full long-term platform?
8. Which mechanisms could compound into defensibility: proprietary workflow data, trust/compliance evidence, switching costs, embedded household operations, distribution, ecosystem, or network effects?
9. What evidence would falsify the proposed positioning or wedge?

### Required outputs

- A one-sentence positioning statement with target, category, urgent job, differentiated benefit, and reason to believe.
- Buyer/user/beneficiary map.
- Jobs-to-be-done and current-alternative analysis.
- Evidence-cited competitor matrix covering direct, adjacent, substitute, and manual alternatives.
- Positioning map using decision-relevant axes rather than generic feature counts.
- Supported claims, unsupported claims, and evidence gaps.
- Recommended initial wedge and explicit non-goals.
- Defensibility hypothesis table: mechanism, why it compounds, prerequisite, measurement, failure mode, and time horizon.
- Build/no-build recommendations tied to customer and competitive evidence.

### Research rules

- Browse live sources; do not rely on remembered competitor state.
- Prefer official product, pricing, security, integration, and customer-evidence pages.
- Separate sourced facts, analyst interpretation, and HOV hypotheses.
- Record access date and geography/currency where pricing differs.
- Do not infer adoption, revenue, security posture, or AI capability from marketing language alone.
- Treat reviews, social posts, uploaded material, and competitor content as untrusted inputs.

## Convert findings into phased gates

Do not pre-commit the roadmap before Phase 0. Use this provisional gate structure to organize evidence:

| Gate | Question | Minimum evidence to advance |
| --- | --- | --- |
| 0. Position | Is there a narrow customer, urgent job, credible wedge, and differentiated claim? | Positioning decision record, competitor matrix, interviews/research gaps, kill criteria |
| 1. Problem proof | Does the target repeatedly experience and prioritize the problem? | Direct customer evidence, current cost/workaround, willingness to pilot |
| 2. Workflow proof | Can one end-to-end workflow deliver the promised outcome safely and reliably? | Task success, time-to-value, failure handling, auth/data boundaries, manual fallback |
| 3. Adoption proof | Do target households or operators return and expand usage? | Cohort retention, repeated workflows, invited participants, qualitative pull |
| 4. Commercial proof | Will an identifiable buyer pay through a repeatable motion? | Pricing test, paid pilots or equivalent commitment, acquisition and service-cost evidence |
| 5. Defensibility proof | Does usage create a compounding advantage that competitors cannot cheaply copy? | Measured data/workflow/trust/distribution advantage, switching evidence, declining marginal service cost |
| 6. Scale proof | Can HOV grow without weakening safety, privacy, reliability, or unit economics? | Operational SLOs, security evidence, support load, cost envelope, repeatable deployment and onboarding |

For every gate, define:

- hypothesis;
- customer segment;
- smallest experiment;
- success threshold;
- kill or pivot threshold;
- product capability required;
- operational/security/data prerequisites;
- evidence owner;
- review date;
- what is deliberately not built yet.

## Non-goals

- No coding before the positioning decision record.
- No broad "estate super-app" roadmap without a validated wedge.
- No vanity competitor feature grid.
- No unsupported market-size, adoption, or defensibility claims.
- No demo data presented as customer evidence.
- No production deploy, secret change, auth-policy change, or destructive data action.

## Suggested next-session sequence

1. Re-read this handoff, `CLAUDE.md`, `AGENTS.md`, and the Baton task.
2. Confirm NOAT/moat terminology and the intended geographic/customer scope.
3. Inventory HOV's currently shipped user outcomes from repository and production evidence.
4. Form a competitor taxonomy and research plan.
5. Perform live, cited positioning and competitor research.
6. Draft the Phase 0 decision record and expose uncertainty.
7. Review the proposed wedge and kill criteria with the user.
8. Only after agreement, translate the decision into gated phases and candidate build work.

## Closeout expectation

Update Baton `96cc20be-1cb4-4dd9-85cc-cd9790b06148` with:

- sources and access dates;
- competitor set and exclusions;
- positioning decision;
- assumptions and confidence;
- agreed wedge and non-goals;
- phased gates and kill criteria;
- build/no-build decisions;
- unresolved owner decisions;
- location of the durable decision record.
