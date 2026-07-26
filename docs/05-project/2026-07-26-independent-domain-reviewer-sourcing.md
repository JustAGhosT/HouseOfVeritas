# Independent domain reviewer sourcing and micro-trial

- Date: 2026-07-26
- Status: Recommendation and trial specification only; no candidate contacted,
  booked, appointed, or paid
- Baton task: `9bba1180-b6a4-49cb-b1fc-45bdcbb4cd3c`
- Initial domain profile: South African domestic plumbing, limited to the Gate 0
  under-sink drain-joint triage protocol
- Synthetic testing surface:
  [PIRB domain reviewer testing surface](2026-07-26-pirb-domain-reviewer-testing-surface.md)

## Decision

Abstract the plumbing-review workflow as an **independent domain reviewer**
contract, but keep credentials, safety boundaries, evidence requirements, and
acceptance rules in a versioned domain profile.

The abstraction must not turn a generic marketplace profile, identity check,
rating, or model-generated answer into professional eligibility. For the first
domain, appointment still requires current South African plumbing credentials,
relevant domestic waste/drainage experience, conflict review, and owner
acceptance under the
[Gate 0 discovery package](2026-07-26-under-sink-leak-gate-0-discovery-package.md).

Recommended sourcing order:

1. PIRB/IOPSA direct discovery and credential verification;
2. Kandua as a locally vetted candidate-discovery channel;
3. RentAHuman as a credential-gated experimental bounty, not direct booking;
4. Upwork consultation or local quote marketplaces as fallback discovery;
5. engineering/scientific expert networks only for later standards or design
   review, not as a substitute for the first plumbing reviewer.

## Reviewer role abstraction

Use separate capability profiles so a trusted personal reviewer can contribute
to alpha testing without accidentally inheriting professional safety authority.

| Capability                     | Who may be nominated                                                                                                                                 | Permitted decisions                                                                                                                                       | Prohibited decisions                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DomainSafetyReviewer`         | Independently verified professional who passes the domain profile.                                                                                   | Accept, narrow, reject, withdraw, or version the plumbing observation/escalation protocol within the contracted scope.                                    | Product launch, participant recruitment, commercial ranking, privacy approval, or owner funding.                                                    |
| `AlphaExperienceReviewer`      | Owner-nominated person, trusted referral, target-role proxy, accessibility/language reviewer, or marketplace candidate who passes the alpha profile. | Evaluate workflow clarity, consent comprehension, burden, role fit, neutral-comparison wording, accessibility, and failure recovery using synthetic data. | Plumbing diagnosis, safety approval, credential claims, real-household triage, participant consent on another person's behalf, or Gate advancement. |
| `CommercialNeutralityReviewer` | Independent procurement, consumer-trust, or policy reviewer with disclosed commercial interests.                                                     | Review whether comparison wording and ranking factors remain supplier-neutral and understandable.                                                         | Technical-fit decisions, checkout, purchasing, affiliate approval, or plumbing safety.                                                              |
| `PrivacyResearchReviewer`      | Owner-approved privacy/legal or research-governance reviewer.                                                                                        | Approve or reject collection, consent, storage, retention, operator, correction, withdrawal, and incident controls.                                       | Plumbing safety or product-market claims.                                                                                                           |

One person may hold more than one capability only when they independently pass
every applicable profile and the overlap is recorded. A personal relationship or
referral is not automatically disqualifying for alpha experience, but it is a
conflict signal and may prevent the person from serving as the sole domain,
privacy, or commercial-neutrality approver.

### Generic nomination record

`ReviewerNomination`:

| Field                      | Meaning                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `candidateId`              | Non-secret pseudonymous candidate identifier.                                                                   |
| `capabilityRequested`      | One or more explicit reviewer capabilities.                                                                     |
| `nominationSource`         | `registry`, `marketplace`, `owner_personal`, `trusted_referral`, `participant_referral`, or `open_application`. |
| `relationshipToOwnerOrHov` | Relationship, duration, power imbalance, and any financial or household dependency.                             |
| `recommendationChain`      | Who recommended whom and whether each recommender has a commercial interest.                                    |
| `compensation`             | Paid, volunteer, in-kind, or waived; amount and conditions held in the restricted record.                       |
| `conflicts`                | Supplier, retailer, provider, employment, household, referral, investment, product, or outcome interests.       |
| `experienceEvidence`       | Evidence required by the requested capability profile.                                                          |
| `allowedDataClass`         | Alpha defaults to `synthetic`; personal familiarity does not authorize household data.                          |
| `trialVariant`             | Versioned trial pack allocated to the candidate.                                                                |
| `decisionOwner`            | Human who may accept or reject the nomination.                                                                  |

Keep the person's name, contact details, relationship detail, compensation, and
supporting documents outside Git and Baton. Durable records may state only the
candidate ID, nomination category, minimized conflict disposition, profile
result, and owner decision.

### Personal or recommended alpha reviewer

An owner may nominate someone they know or accept a recommendation for alpha
testing when all of these are true:

- the candidate receives a direct invitation and may decline without effect on
  employment, pay, household access, services, references, or relationships;
- the relationship and recommendation chain are disclosed to the decision owner;
- the candidate is scored against the same alpha trial as other candidates;
- feedback is attributed to a conflict category during analysis rather than
  presented as independent customer evidence;
- the person uses synthetic scenarios and a dedicated alpha environment with no
  production credentials or real household data;
- compensation or volunteer status is disclosed and approved; and
- the output is labelled `alpha experience review`, not customer discovery,
  professional approval, or market validation.

A principal, household manager, staff member, family member, friend, existing
vendor, or HOV advocate may provide useful alpha feedback, but their feedback
must not be counted as an independent plumbing review or one of the 12 Gate 0
problem interviews unless they separately meet that study's recruitment,
consent, independence, and evidence rules.

### Alpha experience micro-trial

Use a 30-45 minute paid or explicitly voluntary synthetic session:

The executable script, fictional text prototype, variants, evidence capture, and
severity-based decision rules are in the
[alpha experience reviewer synthetic trial pack](2026-07-26-alpha-experience-reviewer-trial-pack.md).

1. Explain the reviewer's limited authority and confirm consent to notes and any
   separately approved recording.
2. Give the reviewer a fictional issue report with no real address, person,
   household, image, asset, or active safety condition.
3. Ask them to narrate how they would report, assign, stop, escalate, review,
   attach, close, and reopen the fictional issue.
4. Test whether they can distinguish observation from diagnosis and neutral
   comparison from supplier recommendation.
5. Ask them to identify confusing language, missing choices, role/access
   concerns, accessibility constraints, coercive wording, and unsafe confidence.
6. End with correction, withdrawal, and deletion-path comprehension checks.

Alpha scorecard dimensions are comprehension, task completion, error recovery,
role-boundary recognition, consent comprehension, accessibility, neutrality,
and trust concerns. Record severity and reproducibility, not a vanity average.
Any real-world safety advice is discarded and escalated to the domain reviewer;
any personal-information handling concern is escalated to the privacy reviewer.

## Current marketplace evidence

### RentAHuman

RentAHuman supports useful trial mechanics:

- public profile search by skill, city, country, verification, and rate;
- a non-posting `dryRun` preview before a bounty is created;
- fixed or hourly bounties, with a published minimum of USD 10;
- requirements, application questions, acknowledgements, one-file application
  uploads, required links, deadlines, and definitions of done;
- optional government-identity verification;
- escrow, delivery confirmation, payment release, and dispute handling; and
- website, REST API, and MCP flows.

Primary sources:

- [RentAHuman marketplace](https://rentahuman.ai/);
- [bounty documentation](https://rentahuman.ai/docs/bounties);
- [MCP and REST contract](https://rentahuman.ai/mcp);
- [terms of service](https://rentahuman.ai/terms).

The platform is an intermediary and its terms place task, injury, property,
safety, and agent-action risk on users. Identity verification confirms identity,
not PIRB standing, plumbing competence, independence, insurance, or fitness for
this protocol.

Live public API queries on 2026-07-26 found:

| Query                              | Result                 | Decision implication                                                                  |
| ---------------------------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| South Africa plus skill `plumber`  | 0 profiles             | No direct inventory for the exact skill.                                              |
| South Africa plus skill `plumbing` | 1 profile              | Aggregate supply is too thin to establish qualified or appointable domain inventory.  |
| All South African profiles         | 86 reported by the API | Country coverage exists, but broad marketplace size does not establish domain supply. |

Do not promote public-search results into candidate records or retain
profile-level observations in this public repository. Any applicant must enter
through an approved application process and submit current credential evidence
to the restricted reviewer record. Do not post a bounty or expose an API key
until the owner approves the budget, wording, account, and external-processing
boundary.

### Alternatives

| Route                                                                                                     | Trial mechanism                                                                         | Strength                                                                                                                                   | Limitation                                                                                                                                              | Recommendation                                                                                          |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [PIRB](https://www.pirb.co.za/) and [IOPSA](https://www.iopsa.org/Find-a-Plumber)                         | Negotiate one paid remote desktop review with a signed scorecard.                       | Best route to a currently verifiable South African plumbing professional; PIRB exposes company, individual, and CoC verification.          | No standardized trial or escrow workflow; HOV must contract, pay, and retain verification evidence appropriately.                                       | **Preferred.** Shortlist three, verify the individual, then run one or two blinded micro-trials.        |
| [Kandua](https://kandua.com/)                                                                             | Post a clearly bounded paid consultation/desktop-review request and approve a quote.    | South African plumbing inventory; Kandua says pros are background checked and qualifications verified, with quote and secure-payment flow. | Optimized for repair fulfilment; HOV must prevent diagnosis, site work, or repair from entering the trial and still independently verify PIRB standing. | **Secondary local route.** Ask Kandua whether a protocol-review-only scope is supported before posting. |
| [RentAHuman](https://rentahuman.ai/)                                                                      | Preview with `dryRun`, then fund one fixed bounty for a fictional desktop review.       | Agent-native discovery, application fields, identity option, escrow, evidence, and dispute flow.                                           | Current qualified supply is unproven; identity is not credential verification; user retains material task and safety risk.                              | **Experimental fallback.** Open application only; never direct-book the current match.                  |
| [Upwork consultations](https://www.upwork.com/consultations/)                                             | Book a paid 30- or 60-minute consultation with a required follow-up document.           | Mature consultation, scheduling, review, deliverable, and payment-protection mechanics.                                                    | Plumbing trade supply and South African registration are not assured; visible categories skew to digital/business work.                                 | **Fallback.** Use only when the candidate separately passes the domain profile.                         |
| [Snupit](https://www.snupit.co.za/), [Procompare](https://www.procompare.co.za/), or similar quote routes | Request quotes for a paid remote protocol review; compare candidate profiles and terms. | Broad local reach; Snupit and Procompare support multiple quotes and claim verified professionals.                                         | Designed for service leads, may disclose contact details to several providers, and does not replace credential/conflict review or escrow.               | **Discovery fallback.** Use a minimized brief and approved contact channel.                             |
| [Kolabtree](https://www.kolabtree.com/find-an-expert) or engineering networks                             | Commission a small fixed/hourly technical review.                                       | Useful for engineering, materials, standards, study design, or later independent validation.                                               | An engineer or scientist is not automatically competent or authorized for domestic plumbing practice.                                                   | **Later complementary review only.** Never substitute it for the first trade reviewer.                  |

Published local service anchors, not quotes for this work, were approximately
R400-R900 per plumbing hour on Procompare and R450-R650 call-out plus R400-R850
per labour hour on Kandua when accessed on 2026-07-26. A protocol review includes
preparation and a written deliverable, so obtain an explicit fixed quote rather
than treating a repair rate as the reviewer price.

## Reusable reviewer contract

### Purpose

Obtain accountable human judgment where HOV lacks authority or competence, while
preserving a traceable distinction between discovery, trial, appointment,
review, and owner approval.

### Inputs

`ReviewerRequest`:

| Field                        | Meaning                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `requestId`                  | Non-secret stable identifier.                                                           |
| `domainProfileVersion`       | Versioned domain eligibility and safety rules.                                          |
| `jurisdiction`               | Jurisdiction whose credentials and standards apply.                                     |
| `reviewPurpose`              | Exact decision the review informs.                                                      |
| `fictionalTrialPack`         | Synthetic material used before appointment.                                             |
| `requiredOutputs`            | Versioned deliverables and definition of done.                                          |
| `credentialEvidenceRequired` | Issuer, designation, number, expiry/current-status proof, and verification method.      |
| `conflictQuestions`          | HOV, supplier, referral, ranking, employer, and commercial interests.                   |
| `budgetCeiling`              | Owner-approved maximum including platform fees and tax.                                 |
| `dataClass`                  | `public`, `synthetic`, `restricted`, or `prohibited`. Trial must be `synthetic`.        |
| `approvalOwner`              | Human authorized to fund, appoint, accept, or reject.                                   |
| `capabilityProfile`          | Exact authority requested, such as `DomainSafetyReviewer` or `AlphaExperienceReviewer`. |
| `nomination`                 | Pseudonymous nomination record and conflict disposition.                                |

### Outputs

`ReviewerDecisionPack`:

- candidate ID and sourcing route;
- credential verification source, timestamp, result, and verifier;
- experience and jurisdiction fit;
- disclosed conflicts and disposition;
- micro-trial score and independent scorer;
- proposed scope, fee, reliance limits, insurance position, and availability;
- `appoint`, `more evidence`, or `reject` recommendation;
- owner decision and date; and
- next re-verification or expiry date.

Keep names, contact details, credential documents, contracts, tax/payment data,
and signatures in the approved restricted store. The repository and Baton may
hold candidate IDs, minimized results, and public source links only.

### Side effects and approval boundaries

| Operation                                          | External effect                                                      | Required approval                                                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Search public directories or marketplace inventory | Read-only discovery                                                  | None beyond approved research scope.                                                                              |
| Render a platform `dryRun` or local bounty preview | No listing or payment, but may transmit draft text to a platform     | Owner-approved platform account and non-secret synthetic content.                                                 |
| Message a candidate or post a bounty/quote request | External communication and potential personal-information processing | Owner approval of wording, account, privacy path, and budget ceiling.                                             |
| Accept an application, book, escrow, or pay        | Contractual and financial commitment                                 | Explicit human approval for the named candidate and amount.                                                       |
| Share restricted or real household evidence        | Privacy and safety exposure                                          | Prohibited for the micro-trial; later use requires separate Gate approval and participant authority.              |
| Appoint or approve a protocol                      | Safety and governance decision                                       | Named human owner; never autonomous.                                                                              |
| Invite a personal or recommended alpha reviewer    | External communication and relationship/power implications           | Owner approval of candidate ID, invitation, consent, compensation, conflict treatment, and synthetic environment. |

Search and local scoring should be repeatable. Posting, messaging, booking,
escrow, and payment are not idempotent unless the provider exposes and HOV stores
a provider request key. Before any retry, query external state.

## Paid micro-trial specification

There is no evidence of a free qualified-review trial. Do not request unpaid
professional work. Use a small, paid trial with synthetic material.

### Proposed scope

- Duration: 60-90 minutes including a short call and written response.
- Material: one fictional under-sink scenario, the candidate evidence set, stop
  rules, draft BOM rules, and verification-window proposal.
- No real household, participant, address, image, active leak, repair, site visit,
  product recommendation, supplier selection, or legal-compliance certification.
- Candidate may and should reject the issue class or state that evidence is
  insufficient.

### Required deliverable

1. Mark each fictional observation as usable, unsafe, ambiguous, or irrelevant.
2. Identify missing evidence and any question that improperly implies diagnosis.
3. Add or narrow stop/escalation conditions.
4. Flag every unsupported material, dimension, compatibility, or repair inference.
5. Replace or reject the proposed verification checkpoints.
6. State the safe boundary between observation, containment, qualified handoff,
   and plumbing work.
7. Return a signed scorecard with credential and conflict declarations.

### Pass rules

The first domain review cannot be scored against an HOV-authored safety answer
key. Before any seeded defect becomes a pass/fail gate, its expected treatment
and severity must be validated by an independently credentialed domain authority
who did not write the candidate response, with the source and version recorded in
the restricted trial record.

For the initial appointment, use a calibration round instead of a safety pass:

- commission two independently credential-verified candidates on the same
  blinded synthetic pack where practical;
- score only credential, conflict, process, evidence discipline, and fabricated
  certainty until the safety key is independently validated;
- treat divergent safety judgments as unresolved evidence, not as a candidate
  failure;
- use an authoritative source or a third independently credentialed adjudicator
  to resolve material divergence; and
- keep every initial appointment provisional and unable to approve a household
  protocol or advance a Gate until calibration is complete.

Once the answer key and scorer are independently domain-validated, the trial
passes only if the candidate:

- passes the domain credential and independence screens;
- identifies every pre-seeded critical safety defect;
- makes no invented diagnosis, dimension, part, repair, or safe-delay claim;
- escalates missing or conflicting evidence;
- produces actionable, plain-language revisions with traceable rationale; and
- accepts versioning, incident withdrawal, and re-review obligations.

After that validation, any missed critical safety defect is a fail. At every
stage, fabricated certainty, credential mismatch, unresolved conflict, or a
request for real household evidence is a fail. Price and marketplace rating
cannot compensate for a fail.

### Trial variants

Run the same core pack for every candidate, with candidate order and identity
hidden from the scorer where practical:

- Variant A contains an obvious electrical-proximity stop condition.
- Variant B contains a subtle request to infer diameter from an unscaled image.
- Variant C contains a commercial prompt that tries to make a supplier-funded
  item the preferred recommendation.

The variants are regression checks, not trick questions. Tell candidates that
the pack contains deliberately unsafe or ambiguous statements.

### Scorecard

Critical gates are pass/fail and cannot be averaged away:

| Gate                        | Pass condition                                                                |
| --------------------------- | ----------------------------------------------------------------------------- |
| Credential                  | Current domain-profile evidence independently verified.                       |
| Jurisdiction and experience | Exact work class and recent relevant experience accepted.                     |
| Independence                | Conflicts disclosed and accepted; compensation is outcome-neutral.            |
| Critical-defect recall      | Every seeded critical defect identified.                                      |
| Unsafe assertion            | Zero invented diagnosis, part, dimension, repair, delay, or compliance claim. |
| Data boundary               | No request for real household or participant evidence.                        |

Score non-critical quality from `0` (missing/unsafe) to `2` (clear and
actionable): evidence classification, ambiguity handling, stop-rule quality,
plain language, traceable rationale, verification design, and version/incident
governance. Appointment requires every critical gate plus at least 11 of 14
non-critical points. The owner may set a stricter threshold before the first
trial, but may not lower it after seeing a result.

### RentAHuman non-posting preview

The first provider payload should be rendered with `dryRun: true`. This is a
draft against the documentation accessed on 2026-07-26; inspect the returned
preview and current schema before any approved post.

```json
{
  "dryRun": true,
  "title": "South African registered plumber: fictional protocol micro-trial",
  "description": "Review a synthetic under-sink drain-joint observation and escalation protocol. This is a desktop safety/protocol review only: no real household data, diagnosis, repair, site visit, product recommendation, or compliance certificate. The reviewer may reject or narrow the issue class.",
  "category": "research-fieldwork",
  "estimatedHours": 1.5,
  "priceType": "fixed",
  "price": 100,
  "currency": "USD",
  "location": {
    "country": "ZA",
    "isRemoteAllowed": true
  },
  "identityRequired": true,
  "skillsNeeded": ["plumbing", "domestic drainage", "protocol review"],
  "requirements": [
    "Current PIRB registration evidence",
    "Recent domestic sink waste or drainage experience",
    "Supplier, referral, retailer, and HOV conflict declaration",
    "Agreement that the trial uses synthetic evidence only"
  ],
  "completionCriteria": [
    "Return the completed critical-gate and quality scorecard",
    "Redline unsafe, ambiguous, or unsupported protocol statements",
    "State whether to accept, narrow, or reject the issue class",
    "Provide a signed credential and conflict declaration"
  ],
  "evidenceTypes": ["document_upload"]
}
```

Do not place a registration number, identity document, signature, or contact
detail in the public bounty. Request restricted evidence only after the privacy
owner approves the provider and application path.

### Budget gate

Recommended owner ceiling for planning only:

- direct South African route: request fixed quotes and target R1,500-R2,500 per
  complete trial, inclusive of the call and written scorecard;
- RentAHuman: preview a USD 100 fixed bounty, permit counter-offers, and cap at
  USD 150 plus disclosed platform/tax costs; or
- Upwork: one paid 60-minute consultation plus the required follow-up document,
  subject to the same total ceiling.

These are proposed ceilings, not authorization or a representation of fair
market price. The owner should revise them after two or three quotes. Do not
split work to bypass the approval ceiling.

## Provider adapter boundary

Keep the reviewer contract provider-neutral. A sourcing adapter may translate:

```text
search(criteria) -> public candidate summaries
preview(request) -> non-posting provider payload
post(approved request) -> external request ID
applications(request ID) -> candidate IDs and submitted evidence
message(approved candidate ID, content) -> external message ID
book(approved candidate ID, amount) -> contract/escrow ID
status(external ID) -> current external state
close(external ID, outcome) -> final state and payment/dispute evidence
```

The adapter must declare authentication, data location, transmitted fields,
fees, cancellation/dispute rules, idempotency, and owner. Domain eligibility and
scoring remain inside HOV governance, not inside the adapter.

## Recommended next action

1. Complete and browser-verify the synthetic Domain Reviewer Lab before enabling
   any PIRB registry or candidate-data integration.
2. Owner approves or revises the abstraction, sourcing order, trial pack, and
   budget ceiling.
3. Privacy owner approves which provider accounts may receive the synthetic
   bounty and candidate application data.
4. Prepare three candidate slots: two from PIRB/IOPSA or Kandua and, only if the
   owner wants an agent-marketplace comparison, one open RentAHuman bounty.
5. Render previews only. Do not post or message until the owner approves the
   exact preview and external effects.
6. Run one paid trial at a time, score it, then decide whether a second route adds
   useful evidence before spending again.
7. If the owner nominates a personal or recommended alpha reviewer, record only a
   candidate ID and requested capability in Baton; keep identity and relationship
   details restricted, and run the alpha experience trial separately from the
   domain-safety trial.
8. Internally dry-run the alpha pack before any invitation. Passing that rehearsal
   does not authorize contact, recording, compensation, or a live session.
