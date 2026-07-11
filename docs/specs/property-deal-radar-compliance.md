# Property Deal Radar — Compliance & Attribution Page (content)

- **Status:** DRAFT — content for the public `/radar` compliance/attribution surface. Pending legal sign-off (see `property-deal-radar-legal-signoff.md`).
- **Owner:** Jurie
- **Author:** agent session (springs-cheapest-properties — Radar 5, Compliance)
- **Parent spec:** `property-deal-radar.md` (§3, §9, §10 — source of truth)
- **Scope:** The user-facing legal/attribution content that must render on the public Radar page (footer + a linked `/radar/about` or `/radar/sources` page). This document is the *content*; FRONTEND (Radar) wires it into the page. No app code is produced here.

> This is the long-lead legal-track material running in parallel with the data-layer build.
> None of it enables the feature. Publication stays gated by `RADAR_ENABLED` and by the
> human legal sign-off recorded in `property-deal-radar-legal-signoff.md`.

---

## 1. Purpose

Property Deal Radar is a public, unauthenticated page that ranks residential renovation/flip
opportunities in Springs. It presents **facts** (price, beds/baths, erf, suburb, property type)
and a transparent weighted score, and **links out** to the original listing on the source portal.
It does not mirror listing descriptions or photos.

This page exists so a visitor can see, at a glance: where the numbers came from, how fresh they
are, what is estimated versus verified, and how to raise an objection or takedown request.

## 2. Sources used

Per spec §3.2, the following portals are accessed for **structured facts only** (DOM/field
extraction), never for prose summaries, descriptions, or photographs:

| Source | What we take | What we never take |
|---|---|---|
| **Property24** | Price, beds/baths, erf/floor, property type, suburb, listing date, source URL | Listing description text, photos, agent copy |
| **Private Property** | Price, beds/baths, erf, suburb, listing URL | Description text, photos |
| **MyRoof** | Price, beds/baths, erf, distress/bank programme tag, listing URL | Description text, photos |

Supplementary/low-confidence (used sparingly, defaulted to low confidence): Gumtree / OLX
property sections. A **licensed data feed** (Lightstone / PropertyFox / Deeds Office / portal
partner — spec §3, Option A) is the intended clean end-state and replaces the above at v3.

Every displayed row carries its own source attribution (portal name + deep link). We do not
present another portal's content as our own.

## 3. Refresh cadence

- The dataset refreshes on an automated schedule **daily at 04:00 UTC**.
- Each row shows a `lastSeen` date so visitors can judge freshness.
- A row not re-observed for N days is marked `delisted` and de-ranked/hidden (spec §7.6).
- Prices and status can change on the source portal between refreshes — the source listing,
  reached via the link-out, is always authoritative.

## 4. Per-row provenance (required on every card)

Every listing card and every API row MUST expose, per spec §5 and §9:

- **`sourcePortal`** — which portal the facts came from.
- **`sourceUrl`** — a working deep link to the original listing (the "authoritative source").
- **`lastSeen`** — the date the row was last observed on the source.
- **`confidence`** — `verified` (source detail page opened + parsed this run), `feed` (fact-only,
  not opened this run), or `estimate` (derived value). Confidence is shown as a badge and
  **never feeds the score**. Feed-only rows are visibly caveated and cannot hold the #1 slot.

Provenance is not optional and is not a footnote: it renders on the row, not only on this page.

## 5. Disclaimers (must render on the page)

### 5.1 Not financial advice

> **Not financial advice.** Property Deal Radar is an information and research tool. Scores and
> rankings are directional signals generated from public listing facts and a transparent weighting
> you control — they are **not** a recommendation to buy, sell, or invest, and they are **not**
> personalised financial, investment, tax, or legal advice. Do your own due diligence and consult
> a qualified professional before making any property decision.

This mirrors the House of Veritas / global rule against personalised investment advice: the page
gives **generic risk framing only** and must not tell any individual what they personally should buy.

### 5.2 Physical risk is indicative, not a survey

> **Physical-risk flags are indicative, not a survey.** Dolomite/sinkhole and flood indicators
> reflect area-level data and heuristics for the East Rand mining ground. They are **not** a
> geotechnical survey, engineering assessment, or guarantee for any specific stand. Commission a
> professional survey before relying on them.

### 5.3 Estimates are marked

ARV, flip %, renovation-cost, and other derived values are **estimates**, shown with an "estimate"
marker and an `arvConfidence` / sub-score confidence. They are modelled from public facts, not
appraisals.

### 5.4 AI-generated analyst note

Where a per-listing `analystNote` is shown, it MUST be labelled as AI-generated and carry the
"not financial advice" caveat (spec §5.1):

> **AI-generated summary.** This note is written by an automated model from the listing's
> structured facts. It may be incomplete or wrong, does not feed the score, and is not financial
> advice.

The note is produced only for `verified` rows, generated from validated structured fields (not by
re-reading the page), and regenerated on refresh.

## 6. Takedown / contact path (required)

The page MUST provide a clear, monitored contact path for portals, agents, sellers, or any party
to object to a row or request removal:

- A visible **"Report / request takedown"** link on the page and near attribution.
- Contact destination: a monitored channel (email/inbox routed via the HOV notification-service —
  final address confirmed by the owner before go-live).
- Commitment text:

> **Takedown & corrections.** If you are a listing source, agent, or owner and want a row corrected
> or removed, contact us at [takedown contact — TBD by owner]. We honour reasonable takedown
> requests promptly and can disable the entire feature immediately via our kill-switch.

- Operationally, a takedown request is an **exception escalation** (spec §3.1.5) and may trigger
  the `RADAR_ENABLED=false` kill-switch (see `property-deal-radar-killswitch-popia.md`).

## 7. ToS-safe framing (what we tell visitors, and what we actually do)

- We store and display **facts + a link-out**, not copyrighted descriptions or images (spec §10, §3 Option B/C).
- We access source pages **programmatically for fact extraction only**, honouring robots.txt and
  rate limits (spec §3.2, §3.3; enforced per `property-deal-radar-ingestion-compliance-spec.md`).
- We attribute every row and link back to the source as the authoritative listing.
- This mirrors `lib/services/marketplace-service.ts`: **compliant path first, deep-link fallback,
  never a raw crawl.** Radar takes the same posture on the read side that marketplace-service takes
  on the write side — no headless scrape (spec §3 Option D is explicitly rejected).

## 8. Where this content renders

- **Footer** on `/radar`: condensed attribution line, "not financial advice", takedown link.
- **`/radar/about` (or `/radar/sources`)**: the full content of this document.
- **Per-row**: provenance line (§4) and estimate/confidence badges.

FRONTEND (Radar) owns the wiring; this document owns the words. Copy changes to disclaimers or the
takedown commitment should be reviewed against this file and the legal sign-off memo.

## 9. Cross-references

- Residual-risk & legal gate: `property-deal-radar-legal-signoff.md`
- Ingestion robots.txt / rate-limit acceptance criteria: `property-deal-radar-ingestion-compliance-spec.md`
- Kill-switch semantics + POPIA boundary: `property-deal-radar-killswitch-popia.md`
- Parent spec: `property-deal-radar.md`
