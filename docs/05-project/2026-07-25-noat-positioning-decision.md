# House of Veritas Phase 0 positioning decision

Date: 2026-07-25
Status: Provisional decision pending customer discovery
Baton task: `96cc20be-1cb4-4dd9-85cc-cd9790b06148`
Trace: `hov-noat-positioning-competitors-20260725`

## Decision summary

Treat **NOAT** as **moat** unless the user confirms that it is intentional terminology.

Do not position House of Veritas as an "all-in-one estate-management platform."
That category is already occupied by broad global private-estate products, South
African community-estate platforms, and lower-cost household coordination apps.
HOV does not yet have customer, adoption, commercial, or comparative evidence for
a broad superiority claim.

The recommended initial wedge to test is:

> For South African owner-managed private households and small estates with
> multiple staff or service providers, House of Veritas is a household operations
> workspace that turns a photographed maintenance or household issue into a
> safely guided, assigned, reviewable resolution, so the owner or household
> manager can see what happened without chasing messages. Unlike generic task
> apps or estate-community portals, the proposed wedge keeps the issue evidence,
> role-bounded guidance, work record, and reopen history in one household-owned
> operational trail.

This is a **positioning hypothesis**, not a market claim. The narrow segment,
urgent job, buying language, willingness to pay, and comparative value still need
direct customer evidence.

The immediate recommendation is **no broad product build**. Run customer
discovery and a concierge-style pilot using the task and visual-guidance
capabilities that already exist. Build only the smallest gaps that block a real
pilot after Gate 1 evidence is met.

The expanded moat architecture, data planes, reinforcing flywheels, competitive
attack analysis, scorecard, and staged entrenchment path are in
[2026-07-25-household-resolution-graph-moat.md](2026-07-25-household-resolution-graph-moat.md).

## Scope and confidence

### Working scope

- Geography: South Africa first.
- Customer unit: one private household or small private estate, not an HOA,
  sectional-title scheme, rental portfolio, or property-management company.
- Operational profile: an owner-managed home with approximately two or more
  recurring staff members or service providers and enough coordination that
  WhatsApp, calls, paper, and spreadsheets lose context.
- Buyer: principal/owner or delegated household manager.
- Daily users: household manager, staff, residents, and selected service
  providers.

The staff count is a recruitment heuristic, not a market boundary. Interviews
must determine the actual complexity threshold.

### Confidence

| Decision element | Confidence | Why |
| --- | --- | --- |
| Broad "all-in-one estate platform" is poor initial positioning | High | Multiple current products already claim this category across private estates, household coordination, and residential communities. |
| South Africa is the correct first geography | Medium | HOV is deployed in South Africa North and its roles/workflows include local operational context, but no customer evidence has confirmed the launch market. |
| Owner-managed staffed households are the narrowest valuable segment | Low-medium | Product roles and local competitors make the segment plausible; no interviews or observed buying process exist yet. |
| Photo-to-resolution accountability is a credible wedge | Medium as product evidence; low as demand evidence | The workflow has passed an authenticated production proof, but there is no comparative usage or willingness-to-pay evidence. |
| The wedge can become defensible | Low | The mechanisms are plausible but no compounding usage, retention, proprietary outcome data, or distribution advantage exists yet. |

## Product evidence baseline

The following statements are supported by the repository and the completed
production closeout:

- HOV has role-shaped owner/admin, operator, employee, and resident surfaces.
- The codebase contains task, time, asset, inventory, expense, document, project,
  vehicle, and approval workflows; breadth in code is not evidence that every
  workflow is production-ready or wanted by customers.
- Production reports healthy with `dataMode=empty`; demo data is not customer
  evidence.
- An authenticated user completed task creation, persistent reload, Sluice-routed
  visual guidance generation, attachment, close, reload, and reopen against the
  production Mongo-backed task path.
- The proof used a legitimate identity mapped to Hans/admin on the Irma surface.
  It did not prove the genuine resident-role boundary.
- The guidance flow is advisory, includes safety boundaries, requires user review
  before attachment, and retains task context.

Supported product claim:

> HOV has demonstrated one authenticated, persistent, human-reviewed
> photo-to-guidance task loop in production.

Claims that are **not** supported:

- that the loop saves time or money;
- that household staff will use it repeatedly;
- that owners will pay for it;
- that guidance is more accurate or safer than a competitor or a professional;
- that HOV is POPIA compliant as an organization or service;
- that HOV is an all-in-one production system for household operations;
- that current AI capability is unique or defensible;
- that the product has product-market fit, retention, or a moat.

## Buyer, user, and beneficiary map

| Role | Job in the buying/use system | Value sought | Likely objection or risk |
| --- | --- | --- | --- |
| Principal/owner | Economic buyer; delegates household operations | Fewer interruptions, visible accountability, retained household knowledge, reduced avoidable damage | Privacy, staff adoption, setup effort, paying for another app |
| Household/estate manager | Champion and administrator; triages and assigns work | One work record, fewer repeated instructions, easier handover and follow-up | Tool adds data entry instead of removing it |
| Household staff/operator | Captures issues, receives work, performs or escalates | Clear instructions, less ambiguity, proof of completion, access appropriate to role | Surveillance concerns, literacy/language, device/data constraints |
| Resident/family member | Reports problems and reviews relevant outcomes | Simple capture, status visibility, safer self-service for low-risk work | Too many steps; inappropriate DIY guidance |
| Service provider/vendor | Receives bounded context and supplies specialist work | Better issue evidence, access instructions, resolution record | Account friction and excessive data access |
| Family office/advisor | Possible later channel or buyer for multiple homes | Continuity, risk visibility, controlled access, audit/export | Requires enterprise security and assurance HOV does not yet possess |

The product must not equate accountability with employee surveillance. Pilot
consent, role visibility, purpose limitation, and a clear dispute/correction path
are prerequisites.

## Jobs to be done and alternatives

### Primary proposed job

When somebody notices a household or property issue, help the household capture
the real condition, decide whether it is safe to self-handle or must be escalated,
assign the next action, and preserve the evidence through closure so the manager
does not reconstruct events from messages.

### Related jobs

1. Give a staff member or resident the right instructions without exposing the
   rest of the household's records.
2. Let the owner or manager know what is open, blocked, completed, or recurring.
3. Retain household-specific procedures and maintenance history when staff or
   vendors change.
4. Distinguish low-risk guided work from work that requires a qualified
   professional.

### Current alternatives to test in interviews

| Alternative | Why it wins today | Failure hypothesis to validate | Evidence status |
| --- | --- | --- | --- |
| WhatsApp messages, photos, and voice notes | Already installed; familiar; low friction | Context fragments across chats; ownership and closure are unclear; knowledge leaves with people | Common competitor framing, not yet observed in HOV customers |
| Phone calls and in-person instruction | Fast for urgent or ambiguous work | No durable trail; manager repeats instructions; hard to hand over | Hypothesis |
| Paper checklist, whiteboard, or house manual | Visible and simple | Becomes stale; remote owner cannot see status; photos and history are separate | Competitors explicitly position against paper/manual systems |
| Spreadsheet/shared drive | Flexible and cheap | High setup/maintenance effort; weak frontline workflow; attachments and permissions fragment | Competitors explicitly position against spreadsheets |
| Generic task app | Familiar workflow and integrations | Lacks household-specific safety, asset context, staff roles, and issue-to-resolution evidence | Must be tested against real tools used by interviewees |
| Professional household/estate manager | High judgment and service quality | Expensive and creates key-person dependency; software may complement rather than replace the role | Cost and role vary by market; do not claim savings without evidence |
| Call a tradesperson for every issue | Transfers risk to a professional | Delays and call-out costs for low-risk issues | Must not imply that HOV should replace required professionals |

No quantified cost-of-alternative claim is currently supportable. Interviews
must measure manager time, repeated follow-ups, avoidable call-outs, delayed
repairs, and incidents caused by missing context.

## Competitor taxonomy and matrix

Research was accessed on 2026-07-25. Prices are the public prices displayed on
that date, in the stated currency, and are not normalized for tax, exchange rate,
contract term, onboarding, or negotiated pricing.

| Product | Type and target | Publicly supported capability/positioning | Public price signal | Decision-relevant implication for HOV |
| --- | --- | --- | --- | --- |
| [Nines](https://ninesliving.com/) | Direct: HNW households, family offices, private-service professionals, fractional estate managers | Properties, assets, household manual, vendors, documents, schedules, tasks, permissions, AI suggestions, multi-household operation, expert support; SOC 2 Type II claim; self-hosted option is also offered | Pricing not public on the reviewed official pages | HOV cannot claim a unique private-household system of record, granular access, AI, or household manual. Competing head-on would require security assurance, onboarding, mobile quality, and service depth HOV has not demonstrated. |
| [EstateSpace](https://estatespace.com/) | Direct: private estates, principals, family offices, estate-management firms, advisors | Physical-asset system of record across homes, collections, vehicles, projects, vendors, staff, maintenance, documents, and AI-assisted onboarding; public SOC 2 Type I/II, HIPAA, ISAE 3402, and GDPR claims | Starter USD 340/month for 10 users; annual commitment and 14-day trial on reviewed pricing page | Confirms a premium professional segment and raises the trust/assurance bar. HOV should not lead with broad asset management or enterprise security claims. |
| [HomeOps](https://www.homeops.co.za/) | Direct/emerging local: South African families and homes with staff; currently private beta | Family dashboard, schedules, staff, chores, HR portal, kiosk, activity log; claims SA UIF/PAYE localization | ZAR 149, 249, and 449 per month; multi-property marked "coming soon" | Localized household operations and staff compliance are already claimed at consumer pricing. "Built for South Africa" or staff scheduling alone is not a wedge. Beta status creates an opening for validated workflow depth, not a right to dismiss the competitor. |
| [HomeBase](https://homebaseapp.co.za/) | Direct/lightweight local: modern families and household staff | Tasks, photos/instructions, recurring work, shopping, calendars, reminders, role visibility, web access, up to 10 users | 14-day trial; price not visible on the reviewed official pages | HOV's task assignment and household coordination are not unique. HOV must prove that issue evidence, safe guidance, escalation, and closure deliver more value than a simpler planner. |
| [HomeStaff](https://www.homestaff.co.za/) | Adjacent/local specialist: South African household employers | Schedules, attendance, leave, payment breakdowns, loans, compensation, multiple workplaces, shared access, WhatsApp staff assistant | Price not visible; iOS available and Android described as coming soon | Staff administration and a WhatsApp surface are credible adjacent wedges. HOV should integrate or coexist unless customers demand these functions inside the issue-resolution workflow. |
| [HomeZada](https://www.homezada.com/homeowners/pricing/) | Adjacent/consumer: homeowners and multi-home owners | Home inventory, documents, maintenance, remodel projects, finances, reports, and AI chat | Free; USD 99/year Premium; USD 189/year Deluxe for up to three properties | Consumer home records and maintenance are available cheaply. HOV should not compete on inventory breadth or generic reminders before proving operational team value. |
| [EstateMate](https://estatemate.co.za/) | Adjacent/local community: homeowners, body corporates, trustees, tenants, property managers, providers | Estate communication, chat, reports/issues, approvals, access integrations, geolocation, audit trail | Quote/demo motion; no public amount reviewed | It targets community governance and resident-management communication, not one private household. HOV should keep the customer unit explicit and avoid drifting into HOA/community features. |
| [Estavo](https://estavo.co.za/) | Adjacent/local community: South African residential estates | Gate/guest access, maintenance escalation, security alerts, community, role-specific staff/manager tools, audit logs; public POPIA-compliance claim | Quote; flat monthly price with no per-resident or per-gate charge | It demonstrates that role-based maintenance and audit language are also present in the local estate category. Gate, security, and community features are explicit non-goals for the initial HOV wedge. |
| WhatsApp + spreadsheet/paper | Substitute/manual: any household | Familiar communication plus flexible records and no new dedicated system | Mostly sunk/low incremental cost | This is likely the hardest competitor. HOV must remove coordination work within the first issue, not require a long data-migration project. |

### Considered but excluded from the direct set

- [WeconnectU](https://www.weconnectu.co.za/) serves community schemes, rental
  portfolios, and inspection/maintenance operations. It matters for category
  boundaries and potential buyer confusion, but its core customer is a
  professional property-management organization rather than one private
  household.
- Generic work-management products such as Trello, Asana, and Monday.com are
  substitutes. A feature-by-feature review is not useful until interviews reveal
  which products target customers actually use.
- Domestic-service marketplaces are service-sourcing substitutes, not systems of
  household operational record. Include them only if interviews show that
  households prefer outsourcing over coordinating recurring staff.

## Positioning map

Two buyer-relevant axes separate the reviewed products:

- **Customer unit:** one private household/private estate to multi-unit
  community or professional portfolio.
- **Operational depth:** lightweight coordination to governed system of record.

| Position | Products | Meaning |
| --- | --- | --- |
| Private household + lightweight coordination | HomeBase; current HomeOps beta; HomeStaff for the staffing slice | Fast setup and local relevance make this the adoption benchmark. |
| Private household/private portfolio + deep system of record | Nines; EstateSpace | Broad capability, onboarding/support, permissions, and trust posture make this the professional benchmark. |
| Community/portfolio + deep system of record | EstateMate; Estavo; WeconnectU | Strong adjacent category, but a different buyer, governance structure, and unit of value. |
| Private household + narrow execution loop | Proposed HOV wedge | Capture real condition, guide or escalate, assign, evidence, close/reopen. This position is useful only if it produces materially faster or safer resolution. |

The proposed white space is not "AI for estates." Nines, EstateSpace, HomeZada,
and other products already reference AI. The proposed distinction is a
closed-loop operational outcome with household-specific context and review.

### Commerce and material-planning adjacency

Photo-to-product, material-list, estimate, and ordering capabilities also exist
outside the household-operations category:

- [HOVER](https://help.hover.to/en/articles/13363825-estimates-for-construction-pros)
  generates measurement-based material and labor estimates from photo scans or
  blueprints and can pass material lists into supplier ordering.
- [The Home Depot Material List Builder AI](https://corporate.homedepot.com/news/company/home-depot-launches-ai-powered-material-lists-help-pros-save-time-building-complete)
  turns project intent into editable material lists, then connects accepted
  lists to product recommendations, account pricing, inventory, and ordering
  inside one retailer.
- [The Home Depot mobile app](https://www.homedepot.com/c/mobile-app) advertises
  image search, AI project answers, calculators, stock visibility, and checkout.
- [Lowe's Mylow](https://www.lowes.com/l/about/ai-at-lowes) provides project
  guidance and product recommendations inside a retailer experience.
- [MeBuild](https://mebuild.app/) claims South African price comparison across
  Cashbuild, Builders Warehouse, Leroy Merlin, and Makro.
- [Leroy Merlin South Africa's price-match terms](https://leroymerlin.co.za/price-match)
  illustrate why "best price" is conditional: identical SKU, current stock,
  authorized seller, timing, and exclusions for delivery, installation,
  bundles, loyalty pricing, marketplaces, and grey imports.

Therefore photo-to-materials and ordering are promising extensions of the HOV
wedge, but they are not unique features. The defensible opportunity would be the
household-owned context and verified outcome loop across suppliers, rather than
image recognition, a generated shopping list, or affiliate links by themselves.

## Claims ledger

### Claims HOV may make now, with careful wording

| Claim | Basis | Constraint |
| --- | --- | --- |
| HOV supports role-shaped household task workflows | Repository implementation | Do not imply every role has passed a production identity proof. |
| HOV demonstrated persistent task guidance attachment and reopen in production | Completed authenticated closeout | Describe it as one verified workflow, not adoption or reliability at scale. |
| Guidance is advisory and reviewed before attachment | Implemented workflow and architecture | Do not call it professional advice or guaranteed safe. |
| Production can start empty without demo records | Health/data-mode proof | Empty mode is engineering hygiene, not customer value. |

### Claims that require evidence before use

| Candidate claim | Evidence required |
| --- | --- |
| "Resolve household issues faster" | Baseline and pilot median time-to-triage/time-to-close, segmented by issue type |
| "Reduce owner follow-up" | Messages/calls and manager minutes per issue before vs during pilot |
| "Avoid unnecessary call-outs" | Qualified review of issues safely self-resolved; no increase in safety incidents |
| "Keep household knowledge from walking out the door" | Successful staff/vendor handover using retained records and explicit user feedback |
| "Built for South African staffed households" | Local customer interviews, accessibility/device/language evidence, UIF/PAYE boundary decision |
| "Private and compliant" | POPIA role assessment, privacy notices, processing inventory, retention/deletion controls, incident process, and independent assurance appropriate to the claim |
| "Safer AI guidance" | Defined risk taxonomy, professional review corpus, refusal/escalation tests, incident monitoring, and comparative benchmark |

## Recommended wedge and non-goals

### Wedge workflow

1. A resident or staff member photographs an issue and adds a short description.
2. HOV binds the evidence to an authorized household task.
3. The system either:
   - provides bounded, reviewable guidance for an approved low-risk class; or
   - refuses self-service and escalates to the household manager or qualified
     provider.
4. The manager assigns/approves the next action.
5. The performer records completion evidence or a blocker.
6. The manager/resident closes, verifies, or reopens the issue.
7. The household retains a searchable issue and resolution history.

### Expanded resolution-to-procurement loop

The wedge can grow from guidance into procurement without becoming a generic
shopping assistant:

1. **Photo to triage:** identify visible issue candidates, ask for missing views
   or measurements, assign a risk class, and decide guide versus escalate.
2. **Photo to suggestion:** offer bounded next actions with confidence,
   assumptions, contraindications, and a professional-escalation path.
3. **Photo and asset context to draft bill of materials:** use the image,
   household asset record, model/serial label, dimensions, prior repairs, and
   approved procedure to propose tools, consumables, replacement parts, waste
   allowance, and safety equipment.
4. **Bill of materials to compatible local SKUs:** map requirements to exact,
   compatible, and acceptable-alternative products. Never silently substitute
   voltage, pressure rating, dimensions, chemical compatibility, certification,
   color/finish, or warranty requirements.
5. **SKUs to purchase options:** compare timestamped product price, stock
   confidence, delivery fee, lead time, minimum quantity, pack-size waste,
   warranty/returns, seller trust, and travel/pickup cost.
6. **Options to approved cart:** present cheapest, fastest, lowest-risk, and
   preferred-supplier options with a transparent score. A human chooses or edits
   the cart.
7. **Approved cart to order:** order through authorized retailer/supplier
   integrations under household purchasing policies and explicit approval.
8. **Order to outcome:** reconcile confirmation, delivery, receipt, actual
   consumption, returns, completion evidence, and reopen/failure.
9. **Outcome to improved household memory:** learn which diagnosis, quantity,
   brand/SKU, supplier, installer, and procedure worked for this asset and issue
   class.

This is the candidate compounding loop:

> more verified resolutions → better household context and compatibility data →
> fewer wrong suggestions and purchases → faster, more trusted resolutions →
> more verified resolutions.

### Do not promise "best price"

Use **best verified purchase option for the stated policy at a stated time**
instead of "best price." The lowest product sticker price may be the wrong
decision because of delivery, stock, pack size, compatibility, required
accessories, returns, warranty, seller quality, urgency, or travel.

Every comparison should expose:

- retrieval time and freshness;
- retailer/seller and whether it is first-party or marketplace stock;
- exact-match versus compatible-alternative status;
- unit and pack-size normalization;
- item subtotal, delivery, service fees, and known taxes;
- stock and delivery confidence;
- assumptions and unavailable costs;
- commercial relationship or affiliate compensation;
- why each option ranked where it did.

If current price or stock cannot be verified, HOV should say so and offer a
quote-request or retailer handoff, not fabricate a comparison.

### Purchase authority

Ordering is an external financial action and must remain deterministic:

- default to draft cart, never autonomous purchase;
- require explicit approval showing supplier, items, quantities, landed total,
  delivery destination/window, and substitution policy;
- support household budgets, per-role limits, preferred/blocked suppliers,
  duplicate-order checks, and separation of requester/approver above a threshold;
- make the idempotency key and retailer order reference durable so retries cannot
  double-order;
- require new approval when price, quantity, supplier, delivery, or substitution
  changes beyond the approved tolerance;
- retain confirmation, invoice/receipt, return/refund, and approval evidence;
- do not store raw payment credentials in HOV;
- provide a cancel/return path but never imply it is guaranteed.

### Initial issue classes

Recommended first issue class: **minor visible under-sink drain-joint leak
triage**.

This recommendation uses the production-proven visual-guidance scenario while
keeping the initial promised outcome narrow: make the situation safe, gather
decision-quality evidence, determine whether use should stop, and prepare a
qualified handoff. The pilot does not promise diagnosis or repair.

In scope:

- water appears only when the sink drains;
- the visible source appears to be an exposed trap or drain joint;
- the water can be contained with a tray/container and cloth;
- the participant can inspect from floor level without moving a fixed appliance;
- no tools, disassembly, chemical treatment, or purchase is required to complete
  triage;
- the participant can stop using the fixture and contact the household manager.

Immediate stop and professional escalation:

- active flooding or water that cannot be contained;
- hidden source, wall/ceiling ingress, supply-line spray, or hot-water leak;
- proximity to energized electrical equipment or damaged wiring;
- sewage backup, strong sewer odor, contaminated water, mold, or health concern;
- damaged cabinetry/structure, inaccessible joint, or need to work at height;
- child/pet exposure or any participant uncertainty about safe containment.

The first material output is a **reviewed draft repair/handoff list**, not an
automatically purchased DIY kit. It may include the observed pipe/trap size,
joint type, suspected seal/washer or exact replacement assembly, containment
materials, and items a qualified plumber should confirm. HOV should not infer
pipe diameter, thread, material compatibility, or replacement part solely from
one unscaled image.

Why start here:

- it has a short and observable capture-to-safe-next-action cycle;
- the existing fixture and production proof shorten experiment setup;
- it exercises photos, clarifying questions, task persistence, guidance review,
  escalation, completion evidence, and reopen;
- recurrence is objectively observable;
- it creates a controlled bridge to model/measurement capture, compatible parts,
  local price comparison, and provider handoff.

Why not start broader:

- "all minor water leaks" mixes drain, pressurized supply, appliance, irrigation,
  roof, structural, and contamination risks;
- electrical, gas, structural, fire, chemical, medical, security-response, and
  working-at-height classes have higher consequence and different qualified
  owners;
- starting with repair or automated ordering would conflate triage accuracy,
  material compatibility, user competence, and transaction safety.

Advance from triage to a repair/material pilot only after a qualified plumbing
reviewer defines the eligible trap/joint variants, photo/measurement protocol,
approved materials and substitutions, stop conditions, and verification window.

### Recommended commercial and procurement model

Use a **household-paid subscription with neutral procurement comparison** as the
initial model.

Phase 1:

- HOV earns subscription revenue for the resolution workflow and household
  memory, not for steering purchases;
- comparisons include all authorized suppliers that meet the evidence and
  freshness bar;
- ranking follows the household policy and excludes commission;
- the user approves a cart and completes checkout with the retailer;
- HOV does not hold payment credentials, take title to goods, or become merchant
  of record.

Phase 2, only after comparison accuracy and customer trust are proven:

- HOV may accept a disclosed referral or affiliate fee;
- eligibility and ranking remain independent of commission;
- every compensated offer is visibly labeled;
- an uncompensated supplier can still rank first;
- the customer sees the same product, quantity, landed-cost assumptions, and
  retailer checkout price;
- commercial relationships are included in audit and experiment reporting.

Preferred economics:

1. subscription for the core household workspace;
2. optional fixed procurement/convenience fee for an explicitly requested,
   approved service;
3. disclosed retailer referral revenue as secondary upside;
4. negotiated household savings or trade terms, with a transparent rule for how
   savings are passed through.

Do not begin as a reseller or marketplace merchant. Taking title, collecting
payment, or guaranteeing fulfillment adds tax, Consumer Protection Act,
returns/refunds, fraud, warranty, seller-quality, and support obligations before
HOV has transaction volume or operational evidence. Revisit merchant-of-record
status only if customers demonstrably value a single invoice enough to cover
those obligations and neutral ranking can be preserved.

### Explicit non-goals through Gate 2

- broad estate/asset-management replacement;
- HOA, body-corporate, rental, gate-access, or community communication;
- payroll, UIF submission, PAYE filing, or HR system of record;
- shopping, meal planning, marketplace, gamification, surveys, or property-deal
  features;
- autonomous work authorization or vendor dispatch;
- automated purchasing, payment credential storage, or unreviewed substitutions;
- claims to find the universal lowest price;
- claims of professional diagnosis or code/regulatory compliance;
- generic chatbot;
- multi-estate family-office platform;
- new AI model training before consent, provenance, usefulness, and scale exist.

## Defensibility hypotheses

| Mechanism | Why it could compound | Prerequisite | Measurement | Failure mode | Earliest horizon |
| --- | --- | --- | --- | --- | --- |
| Household-specific resolution memory | Each resolved issue can improve future triage, instructions, vendor context, and handover for that household | Repeated use; structured assets/issues/outcomes; export and consent controls | Repeat-issue resolution time; history reuse; handover success | Records become stale or users do not search/reuse them | 6-18 months after repeated usage |
| Safety and escalation corpus | Reviewed outcomes could improve classification of when to guide, refuse, or escalate | Qualified reviewers; risk taxonomy; incident reporting; provenance; sufficient cases | Unsafe-suggestion rate; escalation precision/recall; overrides; incidents | Too little data, biased cases, unacceptable liability, model improvements commoditize the benefit | 12-24+ months |
| Workflow embedding and switching cost | Tasks, evidence, procedures, roles, and vendor history become operational memory | Daily/weekly value, reliable import/export, low-friction staff use | Retention, recurring workflows, records reused, voluntary expansion | Lock-in without value, poor portability, staff workarounds | 6-18 months |
| Trust evidence | Consistent permissions, review, audit, privacy, and safe refusals can reduce buyer risk | Genuine role proof, privacy program, deletion/retention, incident response, security testing | Security questionnaire pass rate; incidents; trust objections; pilot conversion | Marketing outruns assurance; one incident destroys trust | 6-24 months |
| Local workflow distribution | Partnerships with household managers, staffing firms, insurers, maintenance providers, or family-office advisors could lower acquisition cost | Proven customer value and partner incentive | Qualified referrals, conversion, payback period, active households per partner | Partners own the relationship or see no economic value | 12-24 months |
| Cross-household benchmark data | De-identified patterns might improve preventive maintenance and service recommendations | Explicit consent, meaningful scale, strong privacy, comparable data | Predictive lift and avoided incidents vs per-household baseline | Privacy risk, sparse/non-comparable data, easy third-party replication | 24+ months |
| Network effects | Provider reputation/availability could improve with more households | Marketplace liquidity and trust controls | Match rate, time to service, repeat provider use | Cold start, local fragmentation, marketplace distracts from core | Not an initial mechanism |
| Household asset compatibility graph | Verified model, dimensions, installed parts, prior failures, procedures, and substitutions improve future material selection | Reliable asset identity; user correction; structured compatibility; export and deletion | Wrong-part rate; first-time-fit rate; repeat resolution speed | Sparse or stale records; models cannot be identified from photos; manufacturer data unavailable | 6-18 months |
| Resolution-to-BOM outcome data | Linking the original evidence, recommendation, purchased materials, actual consumption, and reopen outcome can improve quantities and choices | Enough safe repeated cases; provenance; reviewer labels; no training without lawful basis/consent | BOM edit distance; unused/returned material; stock-out trips; reopen rate | Generated lists remain generic; outcome labels are noisy; liability exceeds value | 12-24 months |
| Local SKU and offer normalization | Cross-retailer exact/compatible mapping plus landed cost can reduce search and wrong purchases | Authorized catalog/price feeds; identifiers; unit normalization; freshness monitoring | Match coverage; stale-price rate; savings after delivery/waste; order success | Retailers block access, SKUs change, comparison is legally/commercially fragile | 12-24 months |
| Procurement policy and purchase history | Household preferences, budgets, approvals, preferred suppliers, and successful substitutions make recommendations more useful over time | Trustworthy approvals; auditable policy engine; retailer integrations | Approval time; policy violations prevented; reorder accuracy; negotiated savings | Product becomes bureaucratic; bias toward affiliates; unauthorized purchases | 12-24 months |
| Aggregated demand and supplier terms | Sufficient repeat demand could earn better pricing, availability, or service levels | Material transaction volume, transparent economics, supplier relationships | Net price/lead-time improvement versus public offers; supplier-funded margin | Scale too small; channel conflict; savings not passed through; marketplace complexity | 24+ months |

Not moats:

- using a foundation model or adding a chatbot;
- photo recognition or a generated material list by itself;
- retailer affiliate links or scraping public prices without durable rights;
- automated checkout without differentiated selection accuracy and trust;
- having many modules in the repository;
- South African hosting alone;
- local compliance language without workflow ownership and assurance;
- role-based access by itself;
- data volume without consent, quality, repeated outcomes, and measurable lift.

## Build and no-build decisions

### Do now

1. Recruit and interview 12 people from the proposed segment:
   - 4 principals/owners;
   - 4 household or estate managers;
   - 4 staff members/operators, with voluntary participation and no owner present
     for at least part of the interview.
2. Ask for a walk-through of the last three real household issues, including
   messages, handoffs, decisions, delays, call-outs, completion proof, and
   rework. Do not ask only whether the product idea sounds useful.
3. Record the actual tools, buying language, privacy concerns, device/data
   constraints, and who can approve a pilot.
4. Run no more than five concierge pilots using one approved low-risk issue
   class and the current task/guidance loop.
5. Establish the safety/privacy pilot protocol before accepting household data.

### Build only after a discovered blocker

- a lower-friction capture surface if real participants abandon current capture;
- manager escalation/refusal workflow if the selected issue class requires it;
- completion evidence if pilots cannot verify outcomes;
- a manually reviewed draft material list for the selected safe issue class if
  participants repeatedly spend material search time;
- a two-supplier quote/price comparison assembled manually before any catalog
  integration, so value can be tested without premature procurement plumbing;
- accessible/mobile/low-data adjustments observed in the target users;
- minimum export/deletion/retention controls required for pilot consent.

Each build must map to a failed or blocked pilot step and a metric.

### Do not build yet

- modules from the existing broad PRD backlog merely because competitors have
  them;
- payroll/compliance features to match HomeOps or HomeStaff;
- community/access features to match EstateMate or Estavo;
- broad asset features to match Nines or EstateSpace;
- a proprietary model;
- a service-provider marketplace;
- multi-property administration.
- broad retailer scraping, payment storage, autonomous ordering, demand
  aggregation, or negotiated supplier programs.

## Phased gates

The thresholds below are pre-registered decision rules. They may be revised
before an experiment starts, with the reason recorded; they must not be changed
after results are known merely to declare success.

### Gate 0: positioning readiness

- **Hypothesis:** owner-managed South African staffed households have a distinct,
  urgent issue-to-resolution coordination problem.
- **Experiment:** complete 12 problem interviews and code the last three
  incidents from each.
- **Advance:** at least 8 of 12 show the problem without prompting; at least 6
  show a repeated failure or material manager burden; at least 4 can authorize a
  bounded pilot.
- **Kill/pivot:** fewer than 5 show the problem, the job is handled adequately by
  existing tools, or the economic buyer is consistently an HOA/property manager
  rather than a private household.
- **Not built:** new product capability.

### Gate 1: problem proof

- **Hypothesis:** the target will commit time and real workflow evidence to solve
  the problem.
- **Experiment:** recruit up to five households for a defined four-week
  concierge pilot; capture a baseline week where practical.
- **Advance:** at least 3 households start with real issues and nominate both a
  manager and frontline participant; privacy/safety terms are accepted without
  unresolved critical objections.
- **Kill/pivot:** fewer than 3 begin, participants will not use real issues, staff
  participation is coerced, or safe scope is too narrow to matter.
- **Not built:** integrations, marketplace, broad data migration.

### Gate 2: workflow proof

- **Hypothesis:** the bounded loop improves issue clarity and closure without
  increasing risk.
- **Experiment:** run the existing capture-to-close workflow for at least 20
  eligible issues across active pilots with human review.
- **Advance:** at least 70% of eligible issues reach a verified next action
  without out-of-band reconstruction; median manager follow-up is lower than the
  participant's baseline; no severe safety/privacy incident; every unsafe class
  is refused/escalated.
- **Kill/pivot:** guidance creates unsafe action, participants revert to
  WhatsApp for most eligible issues, data entry exceeds perceived benefit, or
  closure evidence is not trusted.
- **Capability allowed:** only blockers observed in the pilot.

Optional material-planning evidence within the same gate:

- participants request material help for at least 8 eligible issues;
- a qualified reviewer accepts at least 80% of draft BOM line items without a
  safety- or compatibility-critical correction;
- the list reduces search/reconstruction time versus the observed alternative;
- wrong-item purchase, unsafe substitution, and duplicate order remain zero.

Failure on these measures removes photo-to-materials from the near-term wedge
without invalidating the core issue-resolution test.

### Gate 3: adoption proof

- **Hypothesis:** households reuse the workflow after assisted onboarding.
- **Experiment:** continue the successful workflow for eight additional weeks
  with reduced concierge support.
- **Advance:** at least 3 households remain weekly active in 6 of 8 weeks; more
  than half of eligible issues enter HOV; at least two households invite another
  legitimate participant; manager and frontline users both report value.
- **Kill/pivot:** usage depends on agent prompting, only the buyer uses it, or
  staff create shadow processes.
- **Capability allowed:** onboarding and recurring-work improvements justified by
  observed friction.

If material planning passed Gate 2, Gate 3 may test **comparison without
checkout**:

- exact/compatible requirements are reviewed before price search;
- at least two authorized local suppliers are compared for an eligible item;
- every offer is timestamped and normalized for pack/unit and known landed cost;
- users choose a recommended option in at least 60% of eligible comparisons and
  explain why;
- stale-price, out-of-stock, and wrong-equivalence rates are measured explicitly.

### Gate 4: commercial proof

- **Hypothesis:** an identifiable buyer will pay enough to support onboarding,
  inference, storage, support, and risk controls.
- **Experiment:** present a priced continuation to retained pilots and test one
  repeatable acquisition channel.
- **Advance:** at least 3 paid households or equivalent non-revocable commercial
  commitments; gross contribution is positive after direct service and model
  costs; onboarding has a bounded repeatable playbook.
- **Kill/pivot:** praise without payment, bespoke support consumes the price, or
  sales require broad unrelated modules.
- **Capability allowed:** billing and minimum buyer administration.

Ordering remains out of scope until comparison accuracy, customer trust, and
commercial value have passed. A limited ordering experiment may then advance
only if:

- a retailer or procurement integration is authorized and contractually usable;
- explicit approval, policy limits, idempotency, reconciliation, cancellation,
  refund, and audit paths have passed tests;
- the first orders are low-value, non-hazardous, non-regulated consumables;
- no order can be triggered by model output alone;
- HOV discloses supplier incentives and demonstrates that ranking is not
  covertly pay-to-play.

### Gate 5: defensibility proof

- **Hypothesis:** repeated usage produces a measurable advantage beyond product
  features competitors can copy.
- **Experiment:** compare new vs mature household outcomes and test portability,
  retained history, partner acquisition, or safety-classification lift.
- **Advance:** at least one mechanism shows measurable compounding improvement
  over two review periods and affects retention, outcome quality, acquisition
  cost, or willingness to pay.
- **Kill/pivot:** retention comes only from contract friction, outcome quality
  does not improve with history, or competitors can replicate the benefit
  without equivalent workflow adoption.
- **Capability allowed:** only the data/trust/distribution mechanism with
  demonstrated lift.

### Gate 6: scale proof

- **Hypothesis:** HOV can grow without weakening privacy, safety, reliability, or
  unit economics.
- **Experiment:** controlled cohort expansion with SLOs, support tracking,
  security review, recovery exercises, and cost attribution.
- **Advance:** agreed SLOs are met for two cohorts; security/privacy findings
  have owners; no unresolved critical incident; support and model/storage cost
  per active household fit the commercial envelope; deployment and rollback no
  longer require manual worker activation.
- **Kill/pause:** unresolved critical security issue, recurring deploy
  activation failure, unsafe guidance incident without containment, or negative
  contribution that worsens with usage.

## Research and evidence gaps

The web research establishes category occupancy and current public competitor
claims. It does not establish customer truth.

Required next evidence:

- confirm whether NOAT means moat;
- confirm geography and whether "estate" means a private staffed property or a
  residential community;
- observe actual recent incidents from target households;
- determine whether owner, household manager, family office, or property manager
  controls budget;
- identify the tools actually used and the cost of current coordination;
- test whether frontline users can and will use photo capture on their devices;
- select one safe issue class with a qualified reviewer;
- determine whether Afrikaans or other language support affects adoption;
- complete a POPIA role/purpose/retention assessment before a real pilot;
- obtain genuine resident-role authorization proof;
- resolve credential/log-redaction and stale-worker deployment follow-ups before
  expanding production use.
- determine which South African retailers or procurement partners offer
  authorized catalog, price, stock, cart, and order interfaces;
- test whether households value materials planning enough to justify the
  liability and integration cost;
- define who is professionally qualified to validate BOMs for each issue class;
- decide whether HOV is a neutral comparison tool, procurement agent, affiliate,
  reseller, or software layer, because incentives, tax, returns, consumer
  protection, and liability differ.

## Sources

Primary sources accessed 2026-07-25:

- Nines: <https://ninesliving.com/>
- Nines self-hosting support: <https://go.ninesliving.com/en/support/does-nines-also-offer-an-on-premise-solution>
- EstateSpace product: <https://estatespace.com/>
- EstateSpace pricing: <https://estatespace.com/pricing>
- EstateSpace security: <https://dev.estatespace.com/security/>
- HomeOps: <https://www.homeops.co.za/>
- HomeBase product: <https://homebaseapp.co.za/>
- HomeBase features: <https://homebaseapp.co.za/features/>
- HomeStaff: <https://www.homestaff.co.za/>
- HomeZada pricing: <https://www.homezada.com/homeowners/pricing/>
- EstateMate: <https://estatemate.co.za/>
- Estavo: <https://estavo.co.za/>
- WeconnectU: <https://www.weconnectu.co.za/>
- South African Government UIF registration:
  <https://www.gov.za/faq/government-services/how-do-i-register-my-domestic-worker-uif>
- South African Government UIF contribution:
  <https://www.gov.za/services/services-residents/world-work/uif/register-uif>
- HOVER photo-based estimates and material ordering:
  <https://help.hover.to/en/articles/13363825-estimates-for-construction-pros>
- The Home Depot Material List Builder AI:
  <https://corporate.homedepot.com/news/company/home-depot-launches-ai-powered-material-lists-help-pros-save-time-building-complete>
- The Home Depot mobile app:
  <https://www.homedepot.com/c/mobile-app>
- Lowe's Mylow:
  <https://www.lowes.com/l/about/ai-at-lowes>
- MeBuild:
  <https://mebuild.app/>
- Leroy Merlin South Africa price match:
  <https://leroymerlin.co.za/price-match>
- Leroy Merlin South Africa delivery:
  <https://leroymerlin.co.za/delivery/>

## Owner review required

Before Gate 0 recruitment, the owner should decide:

1. Is **NOAT** intentional, or should all future records use **moat**?
2. Is South Africa the intended first market?
3. Does "estate" mean a private staffed property, a residential community, or
   both? This decision recommends the private-property meaning only.
4. Is the proposed photo-to-resolution wedge the right problem to test first?
5. Who can provide qualified safety review for the selected issue class?
6. Accept or revise the recommendation to begin with subscription-funded neutral
   comparison, with disclosed referral revenue only after accuracy proof.
7. What purchase amount and product classes, if any, may eventually be approved
   for one-click ordering?
