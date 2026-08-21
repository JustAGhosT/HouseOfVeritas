# House of Veritas — Platform Specification

## Module/Feature Name

House of Veritas Intelligent Physical-Estate Operating System

## Marketing Name

House of Veritas — Intelligent Estate by NexaMesh

## Platform/Mesh Layer(s)

- **Estate Control Layer:** HOV (people, policy, work, assets, incidents, finance, and decisions)
- **Physical Platform Layer:** NexaMesh (trusted observations, device identity, edge execution, mesh transport, and evidence contracts)
- **Service Layer:** DocuSeal and Baserow where explicitly enabled
- **Infrastructure Layer:** Azure (application hosting, databases, storage, identity integration, and monitoring)

## Primary Personas

- **Hans Jurgens Smit** (Owner/Executor, Administrator)
- **Charl** (Employee/Resident, Workshop Operator)
- **Lucky** (Employee, Gardener/Handyman)
- **Irma** (Resident, Household/Childcare)
- **External witnesses or arbiters** (ad hoc, for signatures or dispute resolution)

## Core Value Proposition

An intelligent physical-estate operating system that joins human authority,
trusted observations, operational records, and AI-assisted decisions without
ceding control of the estate to an autonomous model or shared platform.

## Priority

P0 - Critical

## License Tier

Free/Open Source

## Readiness

Draft

## Business Outcome/Success Metrics

- 100% digital signature and document compliance for all governance artifacts
- Accurate, current digital employee, asset, and incident registries
- Zero missed annual reviews or document expiries
- Improved auditability and reduced operational ambiguity
- A governed path from authenticated physical observations to accountable
  incidents, work, expenditure, and retained outcomes

## Integration Points

- Bi-directional webhook/APIs between DocuSeal and Baserow for status sync
- Azure Blob Storage for document archival
- Azure Active Directory or local user management for authentication
- Notification engines for reminders and expiry alerts
- Versioned NexaMesh event contracts for future sensors and edge agents; no
  production device integration is implied by the current specification

## TL;DR

Operate the estate through an Azure-hosted HOV control plane that governs
people, spaces, assets, work, documents, incidents, finance, and decisions.
NexaMesh supplies the future physical-world substrate for trusted observation
and local execution; HOV remains the system of record and human authority.
Today's production capability is the digital operating foundation, not a claim
that the full sensor and edge architecture is already deployed.

## Problem Statement

House of Veritas manages 18 legal and operational documents as well as daily operational records for employees, residents, and assets. Existing processes are partially paper-based and decentralized, which leads to difficulties in tracking compliance, document access, and operational accountability. Confusion over responsibilities, missed expiring documents, and insufficient audit logs pose real operational and legal risks.

## Core Challenge

The main challenge is consolidating all document management, signing, and operational tracking into an integrated, enforceable, low-cost platform with fine-grained access control—while remaining legible and usable for all stakeholders.

## Current State

Documents are managed manually or with generic digital tools. Signature workflows are ad hoc. Tasks, assets, and incidents are tracked with spreadsheets or on paper, and document versioning is informal. Annual reviews, expiry, and legal compliance require significant manual oversight.

## Why Now?

Volume and complexity of governance have outpaced manual approaches. Legally binding e-signatures are now available in open source (DocuSeal). Cloud deployment (Azure) enables security and business continuity. As House of Veritas formalizes as both residential and operational workspace, robust records and compliance become essential.

---

## Expanded Financial & Time Tracking Functionality

### Dual-Mode Financial Tracking

#### 1. Post-Hoc Expense Logging

Users may log actual incurred expenses against configured categories:

- Materials
- Labor/Contractors
- Utilities
- Fuel
- Vehicle Maintenance
- Tool/Equipment Purchase
- Household Supplies
- Professional Services
- Emergency/Unplanned
- Other

Each expense log includes: date, payee, amount, category, related document/project, uploaded receipt, notes, and after-the-fact approval by Hans if required.

#### 2. In-System Expense Approval Workflow with Contractor Payment Milestones

**Submit Expense Request:** Any authorized user (e.g., Lucky) completes a request form in Baserow specifying:

- Item/requested purchase/service
- Budget line or project (Doc 2, Doc 7, etc.)
- Category (see list above)
- Amount requested
- Purpose/justification
- Contractor/vendor details (if contractor payment)
- Payment milestone requested (e.g., deposit, stage payment, completion, final)
- Attachments (quotes, invoices)

**Approval Workflow:**

1. Request submitted – Baserow record created
2. Hans receives task in dashboard and notification
3. Hans reviews, approves/edits/rejects (optional comments)
4. If approved, the payment is scheduled; user receives notification to proceed
5. User logs actual expense/payout on completion (receipted), closing the loop

**Contractor Payment Milestone Tracking:**

- Fields: Contractor Name, Total Contract Amount, Deposit %/Amount, Milestone Stage (description), Stage %/Amount, Stage Actual Date, Completion %, Final Payment Trigger (conditions: e.g. inspection passed), Status.
- Milestones outlined per project (e.g., Doc 7 — Renovation Project Plan), supporting multiple milestones per contract.
- Payments tracked against original contract value, automatically highlighting overrun/remaining amounts.

### Dual-Mode Time Tracking

#### 1. Simple Task-Level Time Logging

For each assigned task/daily to-do:

- Field for "Time Spent" (to be completed upon completion)
- Optionally, "Task Comments" for notes on complexity/delays
- Allows summary views of hours expended per project, person, period

#### 2. Full Clock-In / Clock-Out Tracking with Overtime Calculation

##### New Baserow table: Time Clock Entries

Fields:

- Employee
- Date
- Clock-in Time
- Clock-out Time
- Break Duration (minutes)
- Total Hours (auto-calculated)
- Overtime Hours (auto-calculated: >9/day, >45/week per BCEA; customizable)
- Approval Status (Pending, Approved, Rejected)
- Notes

Each employee records daily attendance, either directly from dashboard or via mobile-friendly form. Weekly dashboard summary auto-flags over-overtime cases for Hans' attention.

### Document Expiry Tracker

**Documents To Be Tracked for Expiry/Renewal:**

| Document                       | Expiry/Review Cycle                | Alert Default      |
| ------------------------------ | ---------------------------------- | ------------------ |
| Property Charter (Doc 1)       | 3 years                            | 60d, 30d, 7d prior |
| House Rules (Doc 2)            | 1 year (annual review)             | 60d, 30d, 7d prior |
| Workshop Safety Manual (Doc 3) | 1 year (OHS review/cert if req)    | 60d, 30d, 7d prior |
| Employment Contracts (Doc 4)   | Annual review                      | 60d, 30d, 7d prior |
| Resident Agreement (Doc 5)     | Annual review                      | 60d, 30d, 7d prior |
| Vehicle Usage Policy (Doc 13)  | 1 year                             | 60d, 30d, 7d prior |
| Insurance Register (Doc 14)    | Per policy renewal date            | 60d, 30d, 7d prior |
| Succession Protocol (Doc 18)   | 3 years (legal/beneficiary update) | 60d, 30d, 7d prior |

**Multi-Stage Alerting System:**

- Storage: Baserow table tracks each document's last update, next expiry/review, assigned responsible, status.
- Alerting:
  - First alert: 60 days out (notification banner/email, color = green)
  - Second: 30 days out (banner/email, color = yellow)
  - Final: 7 days out (urgent, banner/email/red)
- Alerts configurable per document type (Hans can set custom notice periods)
- Dashboard View: Expiry panel with color-coded urgency, quick-action: "Initiate Review/Renewal" button per document

---

## Summary

By embedding comprehensive and configurable dual-mode financial and time tracking, robust contractor milestone management, granular expense categorization, and a highly visible multi-stage document expiry alert system, the House of Veritas platform fully covers operational, financial, and legal risk. The architecture supports experimentation and flexibility, allowing the Owner/Administrator to refine processes as usage matures, while ensuring all critical governance needs are digitized, tracked, and auditable.
