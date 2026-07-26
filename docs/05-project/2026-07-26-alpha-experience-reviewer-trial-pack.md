# Alpha experience reviewer synthetic trial pack

- Date: 2026-07-26
- Status: Internal structural dry-run passed; no reviewer nominated, invited, or
  run
- Capability: `AlphaExperienceReviewer`
- Baton task: `9bba1180-b6a4-49cb-b1fc-45bdcbb4cd3c`
- Governing boundary:
  [Independent domain reviewer sourcing and micro-trial](2026-07-26-independent-domain-reviewer-sourcing.md)
- Operational proof:
  [Alpha review operational E2E rehearsal](2026-07-26-alpha-review-operational-e2e.md)

## Purpose

Run a repeatable 30-45 minute alpha experience review with a personal,
recommended, target-role, accessibility, language, or marketplace reviewer. The
session tests whether a fictional Household Resolution Graph workflow is clear,
controllable, neutral, and trustworthy.

This is not customer discovery, market validation, plumbing advice, a safety
review, or permission to advance a Gate. It uses a text prototype and synthetic
records only; it does not require an application deployment or production access.

## Activation gate

Do not invite or run a reviewer until a named owner records all of the following
outside this public repository:

- candidate identity and contact path;
- candidate ID used in the durable record;
- nomination source and relationship or recommendation chain;
- conflict category and decision-owner disposition;
- paid, volunteer, or in-kind status and any amount or conditions;
- confirmation that declining has no effect on employment, pay, household
  access, services, references, vendor work, or personal relationships;
- approved note-taking and, if proposed, separately approved recording terms;
- approved restricted store and deletion owner; and
- exact trial-pack version and facilitator;
- named, reachable `DomainSafetyReviewer` escalation owner and approved contact
  path for any real-world safety advice or concern; and
- named, reachable privacy escalation owner and approved contact path for any
  personal-information, consent, recording, correction, withdrawal, deletion, or
  incident concern.

The facilitator must test both escalation paths before the session without
transmitting candidate or household information. A pending role, unmonitored
mailbox, or instruction to decide the concern within the alpha session leaves the
activation gate closed.

`Proceed`, a repository merge, a Baton update, or a completed internal dry-run is
not approval to contact a person, spend funds, record a session, or process real
household information.

## Durable nomination worksheet

Keep names, contact details, relationship detail, compensation amounts, and
supporting evidence in the restricted reviewer record. Git and Baton may retain
only this minimized form:

| Field                 | Allowed durable value                                                                   |
| --------------------- | --------------------------------------------------------------------------------------- |
| Candidate ID          | Pseudonymous identifier such as `AER-01`.                                               |
| Capability            | `AlphaExperienceReviewer`.                                                              |
| Nomination source     | `owner_personal`, `trusted_referral`, `target_role`, `accessibility`, or `marketplace`. |
| Conflict category     | `none_known`, `personal`, `employment`, `household`, `vendor`, or `commercial`.         |
| Conflict disposition  | `accepted_for_alpha`, `more_evidence`, or `rejected`; never imply independence.         |
| Compensation category | `paid`, `volunteer`, `in_kind`, or `waived`; omit the amount.                           |
| Allowed data class    | Must be `synthetic`.                                                                    |
| Trial pack            | `AER-SYNTH-001-v1` plus assigned variant.                                               |
| Decision owner        | Non-secret role or approved owner ID.                                                   |
| Nomination state      | `proposed`, `approved_to_invite`, `declined`, `scheduled`, `run`, or `closed`.          |

## Reviewer opening statement

Read this without shortening the authority limits:

> You are reviewing a fictional workflow, not a real plumbing problem or
> household. We want feedback on clarity, control, consent, accessibility,
> neutrality, and trust. Please do not diagnose the issue or recommend a repair,
> part, supplier, or safe waiting time. You may stop, skip a question, correct
> your notes, or withdraw. Your feedback cannot approve safety or advance a
> project gate. Declining or criticising the workflow has no negative effect on
> your relationship with the inviter or House of Veritas.

Confirm verbally or in writing before starting:

1. the scenario is fictional and contains no real household data;
2. the reviewer understands the limited role;
3. the approved note-taking or recording choice;
4. the reviewer may stop, correct, or withdraw; and
5. the reviewer has no immediate relationship or compensation concern they want
   escalated before continuing.

If any confirmation fails, stop and record only `not started` plus a minimized
reason category.

## Synthetic scenario `AER-SYNTH-001-v1`

All people, places, records, providers, and events below are invented.

### Fictional issue report

```text
Reporter: Household User A
Location label: Kitchen cabinet K-01
Observation: "I noticed moisture inside the cabinet after the sink was used. I
have stopped using it. I do not know where it came from."
Attachment: Synthetic placeholder labelled "image unavailable"
Requested outcome: Record the observation, notify the responsible household
role, preserve a clear stop/escalation path, and track an authorized handoff.
```

The prototype must never state a cause, required part, repair, safe delay,
regulated work class, or compliance outcome.

### Text prototype

#### Screen A: report

```text
Report an observation
[What did you notice?]
[Where did you notice it?]
[When did you notice it?]
[Add an optional synthetic attachment]

Do not diagnose or attempt work. If there is immediate danger, active flooding,
electrical contact, injury, or uncertainty about safety, stop and use the
household's approved emergency path.

[Save draft] [Submit observation] [Cancel]
```

#### Screen B: review and control

```text
Observation received — not diagnosed
Status: Awaiting authorized review

You can correct the observation, withdraw it, ask who can see it, or request
deletion. Withdrawal does not erase required incident evidence automatically;
the approved privacy owner decides any lawful minimum record.

[Correct] [Withdraw] [Who can see this?] [Request deletion] [Use escalation path]
```

#### Screen C: assignment

```text
Assign coordination — not repair authority
Available role: Household Manager B
Purpose: confirm the next authorized handoff and communication owner.

Assignment does not authorize diagnosis, purchasing, site work, or a repair.

[Assign] [Choose another authorized role] [Stop and escalate]
```

#### Screen D: neutral comparison

```text
Compare eligible options
Option X and Option Y are fictional providers shown in rotating order.

Comparison fields: verified scope, availability window, disclosed fee basis,
credential evidence status, conflict disclosure, and reliance limits.

No preferred badge, affiliate ranking, checkout, purchase button, discount
steering, or claim that either option is technically suitable.

[Review evidence] [Record questions] [Return to authorized owner]
```

#### Screen E: closure and reopening

```text
Coordination checkpoint
The authorized owner may record whether the handoff occurred and whether more
evidence or escalation is required. This is not proof of a successful repair.

[Record handoff] [Needs more evidence] [Escalate] [Reopen observation]
```

## Facilitator run sheet

| Time      | Activity                                                                                     |
| --------- | -------------------------------------------------------------------------------------------- |
| 0-5 min   | Read the opening statement, confirm consent choices, and explain think-aloud.                |
| 5-10 min  | Ask the reviewer to restate the purpose, their authority, and what data they believe real.   |
| 10-30 min | Walk through the assigned-variant version of Screens A-E without teaching the intended path. |
| 30-35 min | Probe the resulting decision, recovery, or stop without revealing or replacing the variant.  |
| 35-40 min | Test correction, withdrawal, deletion, visibility, and escalation comprehension.             |
| 40-45 min | Invite final criticism, confirm note accuracy, and restate the withdrawal path.              |

Use neutral prompts:

- "What would you do next?"
- "What do you think this means?"
- "What, if anything, makes you hesitate?"
- "Who do you believe can see or act on this?"
- "What would you expect to happen after selecting that?"
- "Is anything asking you to infer more than the evidence supports?"

Do not explain a screen until the reviewer has completed or abandoned the task.
Do not ask whether they "like" the concept as a substitute for observed behavior.

## Assigned variants

Assign exactly one variant before invitation. Apply it to the candidate's first
exposure rather than showing the base pack and changing it later:

- include Variant C's recommendation-chain disclosure in the original invitation;
- render Variants A, B, or D in the relevant screen before the walkthrough starts;
- use Variant E only as a pre-invitation facilitator check; and
- do not show the reviewer the base version for comparison during the session.

Keep every unaffected part of the core pack unchanged. Record the variant, but do
not describe it as a trick.

| Variant | Synthetic change                                                                                       | Evidence sought                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `A`     | Screen A includes a fictional electrical-contact warning next to the moisture observation.             | Reviewer stops/escalates rather than continuing ordinary coordination.          |
| `B`     | Screen D initially sorts fictional Option X first and shows that both options have identical evidence. | Reviewer questions ordering and does not interpret first position as approval.  |
| `C`     | The invitation says the reviewer was recommended by someone who supplies fictional Option Y.           | Reviewer identifies or accepts disclosure of the recommendation-chain conflict. |
| `D`     | Screen B uses dense wording and the correction control is available only through an unlabeled icon.    | Accessibility and discoverability failure is identified and severity recorded.  |
| `E`     | The fictional inviter is described as controlling the reviewer's future work allocation.               | Reviewer or facilitator recognizes coercion and stops the session.              |

Variant E is a facilitator safety check, not a scenario to present to a reviewer
or run with a real power imbalance. If that relationship exists, resolve it before
invitation; do not use the session to test whether the candidate tolerates
coercion.

## Evidence capture

Record behavior, quoted fragments only when approved, and the screen or task
where the issue occurred. Do not record inferred emotions, diagnoses, sensitive
relationship detail, or unrelated personal information.

| Finding ID | Screen/task | Observed behavior | Severity | Reproducible | Capability dimension | Proposed change |
| ---------- | ----------- | ----------------- | -------- | ------------ | -------------------- | --------------- |
| `F-01`     | Pending     | Pending           | Pending  | Pending      | Pending              | Pending         |

Severity:

- `critical`: coercion, real-data exposure, unsafe authority inference,
  inaccessible stop/escalation, or inability to withdraw;
- `high`: likely task failure, wrong-role action, diagnosis/supplier implication,
  or materially misunderstood consent or visibility;
- `medium`: recoverable confusion, unnecessary burden, or trust-reducing wording;
  and
- `low`: localized clarity or presentation improvement with no meaningful task or
  rights impact.

Reproducibility is `single`, `variant_specific`, or `repeated`. A single critical
finding still blocks the affected prototype path.

## Scorecard and decision rule

Do not calculate a vanity average. Record each dimension as `clear`, `friction`,
`failure`, `not tested`, or `stopped`:

| Dimension                   | Evidence required                                                                |
| --------------------------- | -------------------------------------------------------------------------------- |
| Purpose comprehension       | Reviewer explains that the workflow coordinates evidence and handoff.            |
| Role-boundary recognition   | Reviewer rejects diagnosis, repair, purchasing, or safety-approval authority.    |
| Task completion             | Reviewer can report, review, assign, checkpoint, and reopen or explains a block. |
| Error and stop recovery     | Reviewer finds cancel, stop, escalation, correction, and reopening paths.        |
| Consent and rights          | Reviewer understands notes/recording choice, withdrawal, correction, deletion.   |
| Visibility and access       | Reviewer can identify or question who may view and act on the record.            |
| Accessibility and language  | Reviewer identifies comprehension, interaction, or accommodation barriers.       |
| Commercial neutrality       | Reviewer does not interpret order, price, or presentation as a recommendation.   |
| Trust and coercion concerns | Reviewer can raise relationship, consequence, incentive, or confidence concerns. |

Session disposition:

- `revise_before_more_alpha`: any critical finding, two or more high findings on
  the same path, coercion, consent failure, or real-data request;
- `run_next_variant`: no critical finding and remaining issues are bounded and
  captured;
- `close_without_reliance`: session was stopped, withdrawn, compromised, or
  outside the capability profile.

`run_next_variant` means only that another synthetic alpha session may add useful
experience evidence after owner review. It is not a product, safety, market, or
Gate decision.

## Closeout record

The public/Baton closeout may contain only:

```text
Candidate ID:
Nomination source category:
Conflict disposition:
Trial pack and variant:
Session state: not_started / stopped / completed / withdrawn
Finding counts by severity:
Dimensions not tested:
Session disposition:
Restricted record owner:
Deletion/review due date:
Owner decision and date:
```

Keep raw notes, recordings, relationship details, consent evidence, contact
details, and compensation records in the approved restricted store. Apply the
shorter approved retention period whenever the evidence is no longer needed.

## Internal dry-run checklist

Before any external invitation, an internal facilitator may rehearse the pack
without impersonating a candidate and without generating participant evidence:

- confirm every name, provider, location, and attachment is visibly fictional;
- confirm no screen diagnoses, prescribes, recommends a supplier, or claims a
  safe delay;
- verify that stop, correction, withdrawal, visibility, deletion, escalation,
  and reopen prompts are present;
- rehearse the minimized finding and closeout records;
- verify the assigned variant does not expose or exploit a real relationship;
- test that the named domain and privacy escalation owners and approved contact
  paths are reachable, without transmitting candidate or household information;
- confirm the facilitator knows which concern routes to the domain, privacy, or
  decision owner and must not adjudicate it in-session; and
- record only `internal dry-run passed/failed`, pack version, and corrections.

Passing the internal dry-run leaves the activation gate closed.

## Internal dry-run evidence

The repository-only structural rehearsal passed on 2026-07-26 for
`AER-SYNTH-001-v1`:

- every person, location, provider, attachment, and event is labelled fictional
  or synthetic;
- the opening statement preserves limited authority, voluntary participation,
  and no-negative-effect language;
- every assigned variant is applied before invitation or first screen exposure,
  and the baseline is not used to prime the reviewer;
- the prototype exposes stop, cancel, correction, withdrawal, visibility,
  deletion, escalation, and reopen paths;
- diagnosis, repair, parts, safe-delay, supplier-preference, purchasing, and
  compliance assertions are prohibited rather than supplied;
- evidence capture uses a candidate ID and minimized categories, with restricted
  records kept outside Git and Baton; and
- activation requires tested, reachable domain-safety and privacy escalation
  routes, which remain pending; and
- the closeout rule cannot produce a product, safety, market, or Gate decision.

This was a document/control rehearsal, not a usability session. It provides no
evidence that a reviewer understands or can use the workflow. The activation gate
remains closed pending the named approvals in this pack.
