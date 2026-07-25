# Household Resolution Graph moat

Date: 2026-07-25
Status: Strategy hypothesis; not authorization to build
Baton task: `96cc20be-1cb4-4dd9-85cc-cd9790b06148`

## Thesis

House of Veritas should not try to entrench a moat by accumulating unrelated
estate features. It should build a compounding household resolution system:

> HOV remembers the physical household, understands the evidence around a
> problem, governs who may act, connects the action to compatible materials and
> trusted help, and learns from the verified result.

Call the underlying data and workflow model the **Household Resolution Graph
(HRG)**.

The HRG is not one AI model or one database technology. It is the durable,
provenance-aware relationship among:

- household, property, area, and exact location;
- asset, component, model, serial/batch, dimensions, and dependencies;
- observation, photo, symptom, measurement, and environmental context;
- risk class, uncertainty, refusal, escalation, and approval;
- task, procedure, instruction version, performer, and reviewer;
- material requirement, compatible SKU, tool, quantity, and substitution;
- supplier, offer, stock, delivery, warranty, and return;
- provider, credential, quote, attendance, and service outcome;
- spend, insurance/warranty relevance, downtime, and avoided loss;
- completion evidence, verification, recurrence, failure, and reopen.

The moat is not possession of these nouns. Maintenance, digital-twin, retail,
and household products already possess many of them. The moat hypothesis is the
quality and density of the **verified edges** between them for real household
work, combined with trusted local execution.

## Why this could be durable

The graph can improve the next decision in ways that a stateless assistant or
retailer cannot:

- "This looks like a leaking trap" becomes "This is the kitchen scullery's
  40 mm PVC P-trap installed in 2024, reopened twice after seal-only repairs,
  with an approved isolate-and-escalate procedure and a preferred plumber."
- "Buy sealant" becomes "The prior product failed on this substrate; this exact
  compatible SKU is in household stock, while the best delivered replacement
  available before 16:00 is option B."
- "Task complete" becomes "The leak stopped, the meter/photo check passed after
  24 hours, actual materials differed from the draft list, and the resolution
  remained closed for 90 days."

Each verified outcome can make later triage, material selection, purchasing,
handover, preventive maintenance, and provider selection better. That is the
compounding property HOV must measure.

## Market adjacency warning

Pieces of this system already exist:

- [MaintainX](https://help.getmaintainx.com/about-work-orders) uses asset files,
  procedures, work history, parts, and completion summaries to enrich later work
  orders and an organizational knowledge base.
- [Matterport](https://matterport.com/solutions/facilities-management) binds a
  spatial digital twin to tagged details, measurements, asset management,
  maintenance, collaboration, and integrations.
- [HOVER](https://help.hover.to/en/articles/13363825-estimates-for-construction-pros)
  turns photo-based scans into measurements, estimates, material lists, and
  supplier ordering, including insurance workflows.
- [GS1 Digital Link](https://support.gs1.org/support/solutions/articles/43000729075-what-is-gs1-digital-link-)
  connects product identifiers to online product, traceability, and recall
  information.
- Retailers generate material lists, recommend products, expose stock/pricing,
  and fulfill orders.

HOV therefore needs a sharper unit of advantage:

> the governed, longitudinal resolution memory of a private household, across
> people, assets, evidence, suppliers, and outcomes.

## Four data planes

Keeping these planes separate is central to trust and long-term optionality.

### 1. Household-private plane

Owned and controlled for one household:

- property layout and sensitive locations;
- asset identities and documents;
- household members, staff, permissions, routines, and access details;
- issue photos and work history;
- purchases, costs, providers, preferences, and approvals;
- safety events, disputes, and corrections.

Default: no cross-household training or sharing. Export, deletion, retention,
and role visibility are product capabilities, not support tickets.

### 2. Expert-knowledge plane

Reusable, versioned, and provenance-bearing:

- manufacturer manuals and safety notices;
- expert-reviewed triage and procedure packs;
- regulatory or standards references;
- risk taxonomies and escalation rules;
- material compatibility and substitution rules;
- measurement and evidence requirements.

Every item needs source, version, jurisdiction, reviewer/owner, effective date,
expiry/review date, and allowed use.

### 3. Product-and-supply plane

Commercial data that changes rapidly:

- GTIN, manufacturer part number, model, dimensions, technical attributes;
- exact-match and compatibility edges;
- local retailer/supplier SKUs;
- timestamped price, stock, delivery, return, warranty, and seller information;
- household trade accounts, negotiated terms, and preferred suppliers.

This plane needs authorized feeds or partnerships. Public-page scraping is not a
durable moat and may be unreliable or commercially prohibited.

### 4. Consented-learning plane

Only data lawfully and deliberately promoted from private household outcomes:

- de-identified issue patterns;
- procedure success/failure by asset or condition class;
- material quantity error and substitution outcomes;
- provider/service performance with fair dispute handling;
- regional availability, lead-time, and price reliability;
- safety refusal and escalation performance.

Promotion must be purpose-specific, minimized, provenance-preserving, and
revocable where required. "Anonymized" must not be asserted merely because
names were removed from rich household data.

## The seven reinforcing moat layers

### Layer 0: trust and permission substrate

Before compounding, HOV must prove:

- genuine role-to-identity enforcement;
- least-privilege household, task, attachment, and purchase access;
- consent and purpose boundaries for photos, staff activity, and learning;
- retention, correction, export, and deletion;
- advisory versus professional decision boundaries;
- human review and safe refusal;
- complete approval and mutation audit;
- reliable deploy, rollback, recovery, and incident handling.

Trust is not a marketing layer added later. It controls whether households will
put enough real context into HOV for any other moat to form.

### Layer 1: household and asset identity

Create a lightweight operational twin, not an expensive 3D-modeling program:

- identify room/area through a label, QR code, NFC tag, or guided selection;
- capture asset nameplate/model/serial and manufacturer documents;
- record dimensions, connections, finishes, consumables, warranty, and service
  intervals;
- connect assets to upstream/downstream dependencies such as isolators, circuits,
  drains, pumps, gates, and network equipment;
- attach a photo timeline showing condition over time;
- use open identifiers such as GTIN/GS1 where available.

Entrenchment comes from verified identity and change history, not raw photo
volume.

### Layer 2: issue-to-outcome memory

For every issue, retain:

- original observation and uncertainty;
- questions asked and additional evidence supplied;
- risk decision and why;
- recommendation/procedure version;
- human edits, override, refusal, or escalation;
- assigned performer and time to action;
- materials proposed, purchased, consumed, returned, or missing;
- before/during/after evidence;
- verifier and acceptance criteria;
- recurrence/reopen window and eventual outcome.

The system must distinguish:

- recommendation was correct but execution failed;
- diagnosis was wrong;
- material was incompatible;
- quantity was wrong;
- supplier/stock failed;
- provider quality failed;
- issue was resolved but recurred for a different cause.

Without those labels, "more data" will reinforce noise.

### Layer 3: procedure and safety network

Build a governed library of narrow procedure packs:

- eligibility and exclusion conditions;
- required evidence and measurements;
- risk category and competence requirement;
- stop conditions and escalation;
- tools, PPE, materials, and safe substitutes;
- ordered steps and checks;
- completion/verification criteria;
- reviewer qualification and version history.

The valuable asset is not prose generated by a model. It is evidence that a
specific version worked safely for a defined asset/condition class, plus a
record of when it did not.

Potential supply-side partners:

- manufacturers and distributors;
- qualified trades and industry bodies;
- insurers and loss-prevention teams;
- household/estate management professionals;
- training and staffing organizations.

Partners need a reason to contribute: fewer bad call-outs, better pre-arrival
evidence, correct parts, lower claims, product support, qualified leads, or
reduced training effort.

### Layer 4: material and procurement intelligence

Move from generic product recommendation to verified fit:

- exact replacement;
- manufacturer-approved equivalent;
- conditionally compatible alternative;
- temporary containment material;
- professional-only material;
- prohibited substitution.

Rank purchase options by a household policy, not hidden commission:

`fitness + safety + availability + landed cost + time + supplier trust +
warranty/returns + household preference`.

Capture whether the recommendation:

- fit first time;
- required an unplanned adapter/tool/consumable;
- produced waste or shortage;
- was returned;
- delayed the work;
- affected warranty;
- remained successful after the verification window.

Over time, HOV can develop a local compatibility and fulfillment graph that
retailers operating inside their own catalog and global assistants without
household history do not have.

### Layer 5: provider execution network

Do not begin with a marketplace. First make provider handoffs better:

- generate a bounded issue pack with authorized photos, asset data, access
  constraints, prior attempts, and desired outcome;
- request comparable quotes against the same scope;
- record credential/insurance verification appropriate to the job;
- coordinate time and household access without exposing unrelated information;
- reconcile scope changes, materials, invoice, and completion evidence;
- let both household and provider dispute/correct the record;
- measure arrival reliability, first-time resolution, repeat failure, quote
  variance, and documentation quality.

Only after meaningful density should HOV recommend or route providers. A
provider score based on a handful of private jobs is not trustworthy.

The network effect, if it emerges, is local:

> more eligible household demand → better providers see useful, well-scoped work
> → better completion data and availability → faster, more reliable household
> resolution → more eligible demand.

### Layer 6: risk, warranty, and household capital memory

Successful resolution history can support higher-value decisions:

- preventive maintenance timing;
- repair versus replace;
- warranty eligibility and claim evidence;
- insurance documentation and loss mitigation;
- recurring failure and capital-replacement planning;
- supplier/provider negotiation;
- operating-cost and downtime trends;
- property sale, handover, or succession record.

This is a later moat because insurers, lenders, family offices, and buyers will
require reliable evidence and clear data rights. HOV must not imply that a
maintenance record changes coverage, valuation, or claim outcome without a
partner agreement.

## Compounding flywheels

### Resolution flywheel

Real issue → structured evidence → governed action → verified result → better
triage/procedure for the next comparable issue.

Leading measures:

- time to safe next action;
- recommendation edit/override rate;
- first-time resolution;
- severe incident and unsafe-suggestion rate;
- reopen/recurrence by issue class;
- history reused in later work.

### Asset flywheel

Issue or inventory capture → verified asset identity → richer compatibility and
maintenance history → faster future resolution → incentive to identify more
assets.

Leading measures:

- percentage of eligible issues bound to a verified asset;
- successful model/serial capture;
- nameplate/manual retrieval accuracy;
- wrong-asset and wrong-part rate;
- active assets with useful history, not total records.

### Procurement flywheel

Verified BOM → normalized local offers → approved purchase → actual
use/return/outcome → better compatibility, quantity, and fulfillment ranking.

Leading measures:

- critical BOM correction rate;
- landed-cost coverage and freshness;
- first-time-fit;
- unused/returned material;
- extra store trips;
- order failure, duplicate, or unauthorized mutation;
- net savings after delivery, waste, and time.

### Provider flywheel

Better issue pack → clearer quote and prepared visit → higher first-time
resolution → fair outcome record → better future matching and provider
experience.

Leading measures:

- quote comparability;
- provider clarification cycles;
- arrival and completion reliability;
- first-visit resolution;
- dispute/correction rate;
- qualified provider retention.

### Trust flywheel

Clear boundaries → safe useful outcomes → permission to retain more relevant
context → better personalization → more trust.

Leading measures:

- privacy/security objections;
- consent withdrawal and deletion completion;
- role/access incidents;
- human-review completion;
- trust-driven referrals;
- household and frontline-user retention measured separately.

### Distribution flywheel

Proven workflow → partner sees measurable benefit → partner refers suitable
households or contributes knowledge → lower acquisition/onboarding cost → more
proven workflow.

Leading measures:

- qualified households per partner;
- activation and retention by channel;
- partner time/cost saved;
- concentration and channel-conflict risk;
- referrals based on outcomes rather than incentives alone.

## Entrenchment without hostile lock-in

A durable product can be hard to replace because it is valuable, not because it
traps data.

Required principles:

- household can export assets, documents, tasks, issue history, approvals,
  purchases, and provider records in usable formats;
- attachments retain provenance and stable references;
- suppliers and providers are not blocked from accessing records the household
  explicitly shares;
- cancellation does not erase legally or operationally required evidence
  without a transparent retention decision;
- HOV documents which derived insights are household-specific and which are
  reusable product knowledge;
- no dark patterns around consent, auto-ordering, affiliate ranking, or data
  promotion;
- staff records are purpose-limited and correctable, with no hidden productivity
  scoring.

Portability can strengthen the moat: buyers will entrust HOV with richer data if
they know they can leave.

## Competitive attack analysis

| Attacker | Likely move | Why HOV could still win | Required defense |
| --- | --- | --- | --- |
| Household platform such as Nines/EstateSpace | Add visual AI, materials, or local catalog partners | HOV could have deeper verified resolution outcomes and South African execution | Stay narrow; prove outcome lift; secure local expert/supplier/provider partnerships |
| Local household app | Add photo tasks and AI suggestions | HOV could have stronger safety governance, asset compatibility, and closure evidence | Make capture simple enough; do not let governance become unusable |
| Retailer | Add image diagnosis and project ordering | Retailer is constrained to its catalog and has a sales incentive | Neutral cross-supplier policy, household history, compatibility/outcome evidence, transparent economics |
| CMMS/work-order platform | Package a consumer/private-household tier | CMMS is powerful but often operationally heavy and employer-centric | Household privacy, resident/staff experience, low-data/mobile flow, fast onboarding |
| Model provider/general assistant | Improve visual reasoning and shopping agents | Models lack authorized household state, verified outcomes, purchase authority, and local service network by default | Keep models replaceable; own permissions, graph, evaluation, workflow, and partnerships |
| Insurer/home-services network | Bundle prevention, claims, and providers | Strong distribution and risk economics | Become the evidence/workflow layer or partner; never depend on a single carrier |

If a competitor can reproduce a claimed advantage in one sprint by adding a
prompt or UI surface, it is not a moat.

## Moat scorecard

Review quarterly once pilots begin.

| Test | Question | Weak signal | Stronger signal |
| --- | --- | --- | --- |
| Outcome lift | Does accumulated history improve resolution? | More records | Faster safe action, higher first-time resolution, lower reopen rate for mature assets |
| Data uniqueness | Is the information difficult to reconstruct elsewhere? | Uploaded documents | Verified cross-links among evidence, procedure, material, purchase, performer, and outcome |
| Trust | Will users contribute sensitive context? | Privacy policy accepted | Frontline and buyer retention, low access incidents, completed exports/deletions, referrals citing trust |
| Workflow depth | Is HOV part of real execution? | Monthly dashboard view | Majority of eligible issues move through capture, decision, action, and verification |
| Switching value | Would leaving lose useful workflow memory? | Large record count | Household actively reuses history and exports it during handover/planning |
| Supply advantage | Are local offers/outcomes better than generic search? | Many scraped SKUs | High exact-match coverage, fresh landed costs, lower wrong-item/return rate |
| Expert advantage | Does reviewed knowledge outperform generic generation? | Large prompt library | Measured safety/refusal and outcome improvement by procedure version |
| Network density | Does another participant improve the experience? | Provider directory size | Better first-time resolution/lead time in geographies with verified provider density |
| Distribution | Is acquisition becoming more efficient? | Partner logos | Retained qualified households and lower payback through productive partners |
| Economics | Does usage improve margin without harming outcomes? | More orders | Lower support/search cost, better supplier terms, positive contribution with transparent ranking |

## Sequencing to entrench the moat

### Stage A: prove one resolution loop

Use one low-risk issue class. Capture the minimum HRG:

`location → observation → risk → action → evidence → outcome`.

Do not build digital twins, marketplace, automated ordering, or cross-household
learning.

### Stage B: prove asset memory

For repeated or high-value issues, add:

`asset identity → manual/nameplate → procedure version → recurrence`.

Advance only if history is reused and improves a measured outcome.

### Stage C: prove material accuracy

Add manually reviewed:

`requirement → exact/compatible SKU → quantity → actual consumption → fit`.

Advance only if critical correction and wrong-item rates meet the pre-registered
threshold.

### Stage D: prove neutral local comparison

Add:

`SKU → timestamped offer → landed cost/availability → chosen option → fulfillment`.

Use authorized or manually verified sources. Do not order.

### Stage E: prove controlled procurement

Add:

`requester → policy → approver → immutable approved cart → idempotent order →
confirmation/receipt/return`.

Begin with low-value, non-hazardous consumables and explicit approval every time.

### Stage F: prove provider handoff

For professional-only classes, add:

`issue pack → credentialed provider → comparable quote → visit → verified result`.

Do not rank providers until sample size, fairness, correction, and dispute
processes are credible.

### Stage G: prove one external compounding channel

Choose one:

- expert/manufacturer procedure partnership;
- supplier/catalog/fulfillment partnership;
- household-management/staffing distribution;
- insurer/warranty loss-prevention workflow;
- qualified service-provider network.

Do not launch all sides of a marketplace at once.

## Kill criteria

Stop or narrow the moat thesis if:

- household history does not improve a measurable outcome;
- participants will not provide the context required for useful
  personalization;
- frontline users experience the product as surveillance or added bureaucracy;
- expert review and liability cost exceed customer willingness to pay;
- material compatibility cannot be made reliable for a narrow class;
- local catalog/price/stock access cannot be obtained on sustainable terms;
- ordering creates unacceptable error, fraud, refund, or support exposure;
- provider outcomes cannot be compared fairly;
- the only retention comes from data friction or long contracts;
- competitors' generic capabilities match HOV without needing the accumulated
  workflow and partner assets.

## Decisions required before implementation

1. Confirm the initial household segment and the recommended first issue class:
   minor visible under-sink drain-joint leak triage, with containment and
   qualified handoff rather than promised repair.
2. Accept or revise the recommended commercial sequence: household subscription
   plus neutral comparison first; retailer checkout handoff; disclosed,
   ranking-independent referral revenue only after accuracy proof; no early
   reseller or merchant-of-record role.
3. Set data-plane boundaries and cross-household learning defaults.
4. Name the qualified owner of procedure and safety validation.
5. Define which identities and product standards HOV will use for assets/SKUs.
6. Decide what evidence closes an issue and how long until success/recurrence is
   evaluated.
7. Define export, deletion, retention, and staff correction rights.
8. Choose the first potential distribution or knowledge partner only after the
   base workflow passes.

## Sources

Primary sources accessed 2026-07-25:

- MaintainX work orders and knowledge base:
  <https://help.getmaintainx.com/about-work-orders>
- MaintainX parts/work-order history:
  <https://help.getmaintainx.com/view-parts-data>
- Matterport facilities management:
  <https://matterport.com/solutions/facilities-management>
- Matterport Property Intelligence:
  <https://matterport.com/news/matterport-launches-property-intelligence-transforming-real-estate>
- HOVER estimates:
  <https://help.hover.to/en/articles/13363825-estimates-for-construction-pros>
- HOVER insurance workflow:
  <https://help.hover.to/en/articles/12641171-hover-for-insurance>
- GS1 Digital Link:
  <https://support.gs1.org/support/solutions/articles/43000729075-what-is-gs1-digital-link->
