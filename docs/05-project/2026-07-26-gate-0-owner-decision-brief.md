# Gate 0 owner decision brief

- Date: 2026-07-26
- Status: Recommendation only; no owner approval, reviewer appointment, or fieldwork authorization
- Baton task: `9bba1180-b6a4-49cb-b1fc-45bdcbb4cd3c`
- Governing protocol: [Under-sink leak Gate 0 discovery package](2026-07-26-under-sink-leak-gate-0-discovery-package.md)

## Purpose

This brief reduces the remaining Gate 0 owner decisions to a reviewable form. It
does not approve the research, provide legal advice, appoint a plumbing reviewer,
authorize participant contact, or permit collection of personal information or
real household media.

## Recommended owner decisions

The owner should approve or revise each item explicitly in the
[evidence log](2026-07-26-under-sink-leak-gate-0-evidence-log.md). The current
recommendation is:

| ID  | Recommendation                                                                                                                                                                                 | Reason                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | Use **moat**, not **NOAT**.                                                                                                                                                                    | This is the established strategy term and avoids introducing unexplained terminology.                                                                           |
| O2  | Test South Africa first.                                                                                                                                                                       | It bounds regulation, supplier context, language, pricing, and reviewer eligibility without claiming national demand.                                           |
| O3  | Use one private staffed household or small private estate as the customer unit.                                                                                                                | It keeps the test distinct from community-estate, HOA, rental-portfolio, and property-management workflows.                                                     |
| O4  | Test photo-to-resolution coordination first.                                                                                                                                                   | The demand question is whether evidence, assignment, escalation, and closure reduce coordination burden; it is not a test of automated diagnosis or DIY repair. |
| O5  | Appoint an independent, currently verifiable PIRB professional with relevant domestic waste/drainage experience.                                                                               | The reviewer must be able to narrow or reject the issue class and must not benefit from supplier ranking or referral outcomes.                                  |
| O6  | Approve the protocol only after the responsible party, privacy reviewer, restricted store, authorized researchers, retention periods, deletion/correction owner, and incident owner are named. | The protocol deliberately excludes field collection until operational accountability and safeguards exist.                                                      |
| O7  | Test subscription-funded neutral comparison; keep checkout, purchasing, affiliate ranking, and supplier steering excluded.                                                                     | This tests willingness to pay for trusted workflow and comparison without confounding it with discounts or commerce incentives.                                 |

Approval of O1-O4 or O7 does not remove the O5 and O6 preconditions.

## Plumbing reviewer sourcing and verification

The reusable sourcing routes, provider adapter boundary, and paid fictional
micro-trial are specified in the
[independent domain reviewer sourcing note](2026-07-26-independent-domain-reviewer-sourcing.md).
That abstraction does not relax the plumbing profile below.

### Sourcing route

1. Use the [PIRB company and individual verification tools](https://www.pirb.co.za/)
   to identify or verify a professional. PIRB describes itself as the South
   African professional body for plumbers and exposes separate company, plumber,
   and certificate verification paths.
2. Use the [IOPSA Find a Plumber directory](https://www.iopsa.org/Find-a-Plumber)
   as a second sourcing route, filtering for relevant location and drainage or
   leak-related work.
3. Verify the named individual rather than relying only on company membership.
   The [SAQA professional-body register](https://pbdesig.saqa.org.za/viewProfessionalBody.php?id=831)
   currently lists PIRB recognition through 9 May 2027 and the Licensed Plumber
   and Qualified Plumber designations.
4. Re-verify registration and designation immediately before appointment. Store
   the verification evidence and contact details in the restricted reviewer
   record, not this repository.

Sources were accessed on 2026-07-26. Registry status can change and must be
checked again at appointment.

### Minimum shortlist screen

A candidate proceeds to owner review only when all required evidence is present:

| Screen                        | Required evidence                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and current standing | PIRB registration number, designation, renewal/expiry evidence, and successful current registry verification.                                                     |
| Relevant competence           | Recent domestic sink waste, trap, drain-joint, sanitation, or drainage experience; familiarity with applicable local requirements and materials.                  |
| Review capability             | Willingness to produce the versioned signed outputs in the Gate 0 reviewer brief and to reject or narrow the class when evidence is ambiguous.                    |
| Independence                  | Disclosed supplier, retailer, referral, HOV, and product-ranking relationships; no compensation tied to a Go decision, product choice, or participant conversion. |
| Risk position                 | Declared professional-indemnity/public-liability position and written limits on reliance, scope, and deliverables.                                                |
| Availability                  | Named reviewer, response window, fee basis, re-review terms, and incident/escalation contact.                                                                     |

PIRB registration is a useful competence and accountability signal, not proof
that a candidate is suitable for this research review. The owner must assess the
exact scope and conflicts. PIRB's published code emphasizes health, safety,
technical standards, transparency, and fairness; these principles align with
the proposed independent review boundary.

### Shortlist decision record

Keep candidate names and contact details outside the repository. Record only:

| Candidate ID | Registry verified/date | Relevant experience accepted | Conflicts accepted | Scope/fee accepted | Owner decision |
| ------------ | ---------------------- | ---------------------------- | ------------------ | ------------------ | -------------- |
| `R1`         | Pending                | Pending                      | Pending            | Pending            | Pending        |
| `R2`         | Pending                | Pending                      | Pending            | Pending            | Pending        |
| `R3`         | Pending                | Pending                      | Pending            | Pending            | Pending        |

No outreach has been performed by this brief.

## Recommended research-governance defaults

These are conservative operating defaults for privacy/legal review, not a claim
of organizational POPIA compliance. The [Protection of Personal Information Act](https://www.gov.za/documents/protection-personal-information-act)
establishes conditions including accountability, processing limitation, purpose
specification, security safeguards, and data-subject participation. The
[Information Regulator's POPIA resources](https://inforegulator.org.za/popia/)
also provide objection, correction/deletion, prior-authorization, and security
compromise guidance and forms.

### Named accountability

Before recruitment, record:

- the HOV legal entity or person acting as responsible party and its Information
  Officer or delegated privacy owner;
- a privacy/legal reviewer who is independent of the research completion target;
- the research owner, authorized researchers, deletion/correction owner, and
  security-incident owner;
- every external storage, transcription, scheduling, or communication provider
  that will process information, its purpose, location, access model, and
  contractual/operator safeguards.

### Collection and storage

- Use participant IDs in research records and a separate contact register.
- Use one owner-approved restricted store with named-user access, encryption in
  transit and at rest, multifactor authentication, access logging, and no public
  or organization-wide sharing links.
- Do not place names, contact details, recordings, precise addresses, household
  access/security information, real household photos, raw chats, identity
  documents, financial credentials, or sensitive employment records in Git,
  Baton, HOV production, prompts, model-training corpora, or general chat.
- Disable secondary AI processing and transcription unless the provider, data
  location, operator terms, access, retention, and deletion behavior receive
  explicit privacy approval and separate participant consent.
- Maintain a processing register with purpose, fields, source, access, sharing,
  retention trigger, deletion evidence, and incident status.

### Proposed retention schedule for review

The privacy/legal reviewer must accept or replace these periods before outreach:

| Record                                                                 | Event-relative maximum                     | Absolute outer deadline                                                                 | Earlier deletion trigger                                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Unsuccessful prospect/contact lead                                     | 30 days after recruitment closes           | 60 days after last contact                                                              | Delete unless separate future-contact consent exists.                                     |
| Participant contact register                                           | 90 days after the signed Gate 0 decision   | 180 days after the participant's last contact                                           | Delete after withdrawals, corrections, incentives, and follow-ups are resolved.           |
| Audio recording, if separately approved                                | 14 days after capture                      | 14 days after capture                                                                   | Delete immediately after transcript verification when earlier.                            |
| Redacted transcript or minimized notes                                 | 90 days after the signed Gate 0 decision   | 180 days after the interview                                                            | Delete after coding reconciliation and outstanding participant requests.                  |
| De-identified incident codes and aggregate decision evidence           | 12 months after the signed Gate 0 decision | 18 months after the first research record is collected                                  | Review necessity at six months; delete earlier if the decision no longer needs support.   |
| Withdrawal, correction, deletion, consent, and incident audit evidence | Period set by privacy/legal reviewer       | Concrete calendar deletion or review date approved before the first participant contact | Keep only the minimum evidence required to demonstrate handling and meet approved duties. |

These are maximums, not targets. A shorter period should be used whenever the
research purpose can still be met. A participant request or security incident
may require immediate restriction while the responsible owner determines the
lawful next action.

If recruitment or the study is paused without a restart date, the research owner
must review all records within 30 days. If it is abandoned, delete contact data,
recordings, transcripts, and other identifiable research material within 30 days
of that decision unless the privacy/legal reviewer records a narrower, lawful
exception with a concrete deletion date. The absolute deadlines still apply if
no one formally closes or abandons the study.

### Rights and incident path

- Give participants one monitored contact path for access, correction,
  withdrawal, objection, and deletion requests.
- Log receipt, owner, action, completion evidence, and participant response using
  the participant ID; keep restricted identifiers outside the repository.
- Stop affected processing immediately when access, disclosure, loss, coercion,
  or safety concerns arise.
- Require operators to notify the responsible party promptly of suspected
  compromise and preserve only the evidence needed for response.
- The named Information Officer/privacy owner determines notification and other
  legal obligations using current Information Regulator guidance. The research
  team must not decide that a compromise is too small to escalate.

## Decision response template

The owner can use this template without placing restricted personal information
in the repository:

```text
O1 moat terminology: approve / revise
O2 South Africa first: approve / revise
O3 customer unit: approve / revise
O4 first problem test: approve / revise
O5 reviewer: candidate ID; eligibility approve / reject / more evidence
O6 privacy protocol: approve / revise / blocked
O7 commercial hypothesis: approve / revise

Responsible party:
Privacy/legal reviewer:
Research owner:
Restricted store approved: yes/no (details held outside Git/Baton)
Authorized researcher IDs:
Retention schedule: approve/revise
Deletion/correction owner:
Incident owner:
Decision meeting owner/date:
```

## Next safe action

After the owner records O1-O7 and the named privacy and plumbing gates pass:

1. lock the protocol version and thresholds;
2. approve recruiting, consent, incentive, and price-band language;
3. run a fictional-incident interviewer dry-run;
4. begin the exact 4 principal / 4 manager / 4 voluntary frontline recruitment
   matrix; and
5. keep Gate 1 implementation prohibited until the signed Gate 0 decision.
