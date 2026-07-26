# Alpha review operational E2E rehearsal

- Date: 2026-07-26
- Status: Synthetic operational E2E passed; live reviewer path not activated
- Harness contract: `alpha-review-e2e-v1`
- Trial pack: `AER-SYNTH-001-v1`
- Baton task: `9bba1180-b6a4-49cb-b1fc-45bdcbb4cd3c`

## Outcome

The deterministic harness exercises the alpha-review operational path end to end:

```text
synthetic nomination
  -> activation preflight
  -> invitation preview
  -> simulated consent acknowledgement
  -> assigned-variant first exposure
  -> minimized finding
  -> no-reliance closeout
  -> retention review scheduled
```

It does not impersonate a reviewer, generate participant or usability evidence,
contact anyone, create a restricted record, access production, or authorize a
Gate. Simulated escalation routes prove only that the workflow carries both route
classes; they are not substitutes for the named, reachable domain-safety and
privacy routes required by the live activation gate.

## Replay

Run the successful fixture:

```powershell
node scripts/verify-alpha-review-e2e.mjs tests/fixtures/alpha-review/synthetic-complete.json
```

Expected output:

```json
{
  "candidateId": "AER-SIM-001",
  "disposition": "revise_before_more_alpha",
  "eventCount": 8,
  "mode": "synthetic_harness",
  "packVersion": "AER-SYNTH-001-v1",
  "status": "passed",
  "variant": "B"
}
```

Run the regression suite:

```powershell
pnpm exec vitest run tests/lib/alpha-review-e2e-harness.test.ts
```

The suite also proves that a live-shaped run and a record containing an identifying
field fail closed.

## Harness contract

### Inputs

- versioned synthetic run document;
- pseudonymous ID matching `AER-SIM-*`;
- Variant A-D assigned in the invitation and used on first exposure;
- external-effect flags, all `false`;
- simulated domain-safety and privacy route preflights;
- exact ordered event sequence; and
- explicit false evidence claims.

### Outputs

Success emits one minimized JSON summary to standard output. Failure emits one
generic contract error to standard error and exits nonzero. The harness performs
no writes, network calls, messaging, posting, booking, payment, recording, or
production access.

### Fail-closed rules

The run is rejected when it contains:

- live mode or any external-effect flag set to `true`;
- real/restricted data class;
- identifying/contact, credential-number, recording, raw-note, address, or real
  household keys;
- unknown fields at the run, external-effect, route, evidence-claim, or event
  levels;
- missing, repeated, or reordered lifecycle events;
- a variant introduced after invitation or a baseline shown before the variant;
- Variant E as a live/session variant;
- an unminimized finding or invalid disposition;
- a created restricted record; or
- any participant, usability, customer, market, safety, or Gate evidence claim.

## Executed trace

| Step | Fixture evidence                                           | Result |
| ---- | ---------------------------------------------------------- | ------ |
| 1    | `AER-SIM-001`, synthetic nomination, harness-only conflict | Pass   |
| 2    | Both escalation route classes simulated and preflighted    | Pass   |
| 3    | Variant B present in invitation preview                    | Pass   |
| 4    | Consent acknowledgement simulated; no notes created        | Pass   |
| 5    | Variant B used on first exposure; baseline not shown       | Pass   |
| 6    | High, variant-specific minimized category captured         | Pass   |
| 7    | `revise_before_more_alpha`; reliance `none`                | Pass   |
| 8    | Review date scheduled; restricted record not created       | Pass   |

Negative traces:

- live-shaped fixture: rejected before workflow execution;
- identifying-field fixture: rejected before workflow execution.

## Trace envelope

```text
Trace ID: hov-alpha-review-e2e-20260726
Mode: synthetic_harness
Candidate ID: AER-SIM-001
Pack/variant: AER-SYNTH-001-v1 / B
External effects: none
Participant/usability evidence: none
Restricted record: not created
Disposition: revise_before_more_alpha
Live activation: blocked
```

## Remaining live E2E inputs

An actual personal or recommended reviewer session still requires non-public owner
decisions and records:

1. nominated candidate identity/contact mapped to a pseudonymous candidate ID;
2. relationship, recommendation-chain, conflict, and compensation disposition;
3. direct opt-in language and note/recording choice;
4. restricted store, record owner, deletion owner, and review date;
5. facilitator;
6. tested, reachable `DomainSafetyReviewer` escalation route; and
7. tested, reachable privacy escalation route.

Do not put those personal/contact details in Git or Baton. Completing this
synthetic E2E does not approve O1-O7 or permit external outreach.
