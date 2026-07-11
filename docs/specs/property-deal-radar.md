# Property Deal Radar — Feature Spec (HOV public module)

- **Status:** DECISIONS LOCKED — analyst note + canonicalKey approved (v0.4)
- **Owner:** Jurie
- **Author:** agent session (springs-cheapest-properties)
- **Scope:** Public, unauthenticated page in House of Veritas that ranks residential
  "deal" opportunities (fixer-uppers, distressed, value-add) in Springs and — later —
  configurable areas, refreshed daily and scored on a transparent weighted matrix.
- **Origin:** Grew out of a manual research session ranking Springs fixer-uppers by
  effort / flip % / buy-in. This spec productises that workflow.

---

## 1. Goal & success criteria

Give a buyer a single public page that answers *"what are the best renovation/flip
opportunities in Springs right now, ranked by MY priorities?"* — with the weighting
under the user's control and the underlying numbers grounded, dated, and attributed.

Success = (a) daily-fresh dataset with no manual step, (b) a ranking that survives
scrutiny (verified property type, real erf, dated comps), (c) the user can re-weight
live and the order updates, (d) legally clean.

## 2. Non-goals

- Not a full property portal (no user listings, no agent CRM, no messaging).
- Not financial advice — scores are directional, disclaimer required.
- Not a replacement for Property24/PP — we **link out** to the source listing.
- No authenticated/personalised accounts in v1 (public only; weightings live client-side).

## 3. ⚠️ Load-bearing decision: data sourcing (legal)

**Daily automated scraping of Property24 / Private Property / MyRoof violates their
Terms of Service** and their content is copyrighted. This is the single decision that
gates the whole build. Options, cheapest-risk first:

| Option | How | Legality | Cost | Freshness | Reco |
|---|---|---|---|---|---|
| **A. Licensed data feed** | Lightstone / PropertyFox / Deeds Office / a portal partner API | ✅ Clean | R (subscription) | High | **Preferred if budget exists** |
| **B. Agent-curated daily** | Scheduled Claude/agent run compiles + verifies a small area set, writes normalized rows; light human sign-off | ✅ Grey→clean (facts, links out, attributed, low volume) | Low | Daily | **Preferred MVP** — matches HOV's "official-or-manual" house style |
| **C. Metadata + deep-link only** | Store only non-copyrightable facts (price, beds, erf, suburb) + link to source; never mirror descriptions/photos | ✅ Lower risk | Low | Daily | Fallback / combine with B |
| **D. Headless scrape nightly** | Playwright crawls portals | ❌ ToS breach, fragile, IP-block risk | Low | Daily | **Not recommended** |

**The impossible triangle:** *fully hands-off + ToS-clean + free* — pick two.
Since the priority is **minimising ongoing human effort**, that resolves to two coherent
shapes, and we build for both:

- **Now (MVP): B+C run autonomously.** Agent-curated facts + link-out, but with the human
  taken *out of the daily loop* — replaced by an automated QA gate (see §3.1). Humans are
  touched **only on exception** (source-shape drift, anomaly, takedown). Clean + low-cost +
  near-zero routine effort; the residual effort is occasional exception handling.
- **Target (v3): A licensed feed.** A paid feed (Lightstone / PropertyFox / Deeds Office /
  portal partner) is the *only* path that is simultaneously fully-automated **and** clean —
  it removes even exception handling. It costs money; that's the price of erasing the last
  bit of human effort. The schema is built feed-agnostic so A drops in behind it unchanged.

We do **not** hard-scrape (Option D), regardless of effort savings — it breaks ToS and is
brittle. This mirrors `marketplace-service.ts`: compliant path first, deep-link fallback,
never a raw crawl.

### 3.1 Minimising human effort — the autonomous ingestion loop

Goal: the daily refresh runs unattended; a human is pulled in **only** when the machine
can't vouch for the result. Achieved with automated gates, not manual review:

1. **Scheduled agent run** (daily) fetches the configured area set and extracts *facts
   only* (price, beds/baths, erf, floor, type, suburb, source URL) + normalises.
2. **Auto-classify + auto-score** — property-type classifier (rejects new-dev units),
   sub-scores, ARV/comps recompute — all deterministic code, no human.
3. **Automated QA gate (publish blocker):**
   - Schema/type validation; reject rows failing invariants.
   - Anomaly checks: price ±X% vs suburb median outliers, erf==floor (sectional tell),
     missing source URL, duplicate listingId, day-over-day row-count delta > threshold.
   - Confidence auto-assigned: `feed` by default; `verified` only if the source page was
     actually opened+parsed this run.
4. **Publish** rows that pass; **quarantine** rows that fail into a review queue.
5. **Escalate exception-only** — notify a human *just* for the quarantine queue or a
   source-shape-drift alarm (via HOV notification-service). Empty queue = zero human touch.
6. **Kill-switch** (`RADAR_ENABLED=false`) disables publish instantly on any objection.

Net: steady state is **hands-off**; human effort scales with anomalies, not volume. The
only way to also erase exception handling is the licensed feed (§3, Target).

### 3.2 Source registry & extraction lessons

Per-portal reality, learned from the manual research session that spawned this spec:

| Source | Best for | Access that works | Structured-data quality | Hard lesson |
|---|---|---|---|---|
| **Property24** | Widest stock; best filters (price, erf, type, sort); suburb trend/median + **Sold Prices** | Browser DOM read + JS anchor/field extraction | High — real erf/floor, dates, zoning on detail pages | **Never trust LLM summarisation of the list page** — it invented suburbs (returned Rowhill/Delmas). Extract fields from DOM; **open the detail page** to confirm type/erf. |
| **Private Property** | Reliable direct listing URLs; good freehold resale stock | Browser DOM read | Medium-high; clean per-listing URLs | Many "cheap Selcourt" rows were a **new-build estate** — description tells ("new phase / now selling / estate") flag them. |
| **MyRoof** | **Distressed goldmine** — EasySell / SIE / Pre-Hammer / FNB Quick Sell; own structured cards | Browser with its **filter form / correct URL** (plain fetch fell back to nationwide) | Medium; card fields + bank tag; detail page confirms programme | Bank tag ⇒ route + risk (EasySell = make-offer/occupied; SIE = auction/cash/voetstoots). "In Transaction" ≈ already gone. |
| **Gumtree / OLX (property)** | Private-seller / off-market long-tail | Browser; noisy | Low; free-text | High noise; use only as supplementary, low confidence by default. |
| **Licensed feed (A)** | Clean automated truth incl. **actual sold/transfer prices** | API | Highest | The only fully-automated + ToS-clean option; the v3 target. |

**Extraction principles (non-negotiable, from the hallucination incident):**
1. Ingest **structured fields only** (DOM nodes / feed fields) — never an LLM's prose summary
   of a listing as a source of truth.
2. **Validate every row** against the source URL's own detail page before it can be marked
   `verified`; unopened rows stay `feed` and are caveated in UI (§5, §3.1).
3. Maintain a **validated area→portal-code registry** (e.g. P24: Selection Park=1151,
   Geduld=1093, Strubenvale=1161, Struisbult=1163, Rowhill=1145, Casseldale=1106,
   Selcourt=1146, Dersley=1114, Modder East=1098). Codes are guessed wrong easily — pin them.
4. **Respect robots.txt + rate limits** on any portal access, even for fact extraction.

### 3.3 Residual-risk honesty on Option B

Even "facts + link-out" **accesses** portal pages programmatically, which some portal ToS
prohibit *regardless of what is stored*. B minimises risk (facts not copyrighted, we link
out, low volume, attributed) but does **not** eliminate it. Mitigations: honour robots.txt,
throttle, attribute every row, expose a kill-switch + takedown path, and treat **A (licensed
feed)** as the clean end-state, not a "nice to have". Legal sign-off before enabling Springs.

## 4. Users

- **Primary:** value/fixer-upper buyer-investor (the person driving this).
- **Secondary:** first-time buyer wanting the cheapest sound house in a good area.
- **Public/anonymous** — no login. Weightings persist in `localStorage` only.

## 5. Data model — the dimensions

Each opportunity is one normalized record. Beyond the original three drivers we add the
dimensions below. Each is stored raw **and** as a 1–10 sub-score for the matrix.

### Core drivers (from the research session)
| Field | Meaning | Score direction |
|---|---|---|
| `buyIn` | Asking / expected entry price | lower = better |
| `flipPct` | `(ARV − buyIn − renoEst) / allIn` | higher = better |
| `effort` | Renovation/regularisation work required | less = better |

### Added key dimensions
| Field | Meaning | Why it matters |
|---|---|---|
| `dealScore` | Price vs suburb median (% under/over) | Undervaluation is the flip engine |
| `arvEstimate` (+ `arvBasis`, `arvConfidence`) | After-repair value, **preferring sold/transfer prices** (P24 Sold Prices / Deeds / Lightstone) over asking comps | Denominator of flip % — asking comps bias high and inflate flip %; record the basis + confidence |
| `canonicalKey` | Normalised address + erf + geo hash | Collapses the **same house listed on multiple portals** into one record with many sources |
| `renoCostEstimate` | R estimate derived from effort + floor size | Turns "effort" into money |
| `rentalYieldGross` | Annual rent ÷ all-in | For hold/buy-to-let path |
| `areaQuality` | Suburb desirability + safety index | Resale liquidity + risk |
| `daysOnMarket` | Listing age / time-to-sell proxy | Motivated seller / liquidity signal |
| `distressFlag` | none / EasySell / SIE-auction / Pre-Hammer / deceased / cash-only | Discount + risk profile |
| `erfSize` + `zoning` + `subdividePotential` | Land + General Residential + 2nd-dwelling/subdivide | Non-cosmetic upside (e.g. the Geduld "2-for-1") |
| `propertyType` | freehold house / sectional / new-dev unit | **Guardrail** — new-dev units are not flips (the mistake we must not repeat) |
| `holdingCost` | Rates + levies monthly | Carry cost during reno |
| `affordability` | Bond repayment + min gross income | Buyer reachability |
| `transferFriction` | Transfer duty / no-transfer-duty / sectional | Once-off cost |
| `physicalRisk` | Dolomite/sinkhole + flood flag for the stand | East Rand mining-ground reality |
| `proximity` | Schools / transport / mall / hospital | Desirability + rentability |
| `confidence` | verified (page opened) vs feed-only vs estimate | **Honesty marker** — surfaced in UI |
| `sourceUrl` + `sourcePortal` + `lastSeen` | Provenance + freshness | Attribution + delisting detection |
| `analystNote` | Short LLM-written plain-English take (opportunity + risk) | **Non-scoring** display aid (§5.1) |

### Scoring engine
- Each dimension → 1–10 sub-score via documented rubric (stored, not hardcoded in UI).
- Composite = Σ(weightᵢ × subScoreᵢ) / Σweightᵢ.
- Default weights emphasise the three named drivers; **user can re-weight live**.
- `confidence` never feeds the score — it's shown as a badge so low-confidence rows
  are visibly caveated, not silently ranked. **Feed-only rows cannot be presented as
  fact and cannot hold the #1 slot** without a `verified` upgrade (detail page parsed).
  This directly encodes the trust failures from the research session.

### 5.1 LLM analyst note (non-scoring) — approved

A short generated take per listing ("4-bed + flat, cosmetic TLC, income unit already built;
watch the cash-only clause"). Guardrails:
- **Never feeds the composite score** — all scoring stays deterministic code (the hallucination
  risk is quarantined to a clearly-labelled prose field).
- Generated **from the validated structured fields**, not from re-reading the page, so it can't
  invent facts the row doesn't contain.
- Labelled as AI-generated + "not financial advice"; regenerated on refresh; cached to control cost.
- Only produced for `verified` rows (feed-only rows get no note).

### 5.2 canonicalKey matching (approved — spike then workstream)

Purpose: collapse the same physical house across portals/days into one record. Challenge:
portals hide street addresses ("contact agent for address"), so exact address match often fails.

- **When address/geo present:** geocode → `geohash`; key = `geohash + erf-bucket`.
- **When address hidden (common):** fuzzy composite key on `suburb + erfSize(±tol) + bedrooms +
  price-band + agentName/agency`; treat as *candidate* match with a confidence score.
- Matches below a confidence threshold stay **separate** records (never silently merge) and, if
  ambiguous, drop into the QA quarantine queue for exception review.
- **Spike first** (measure false-merge rate on the Springs seed set) before wiring into ingest.

### 5.3 Classifier & dedupe heuristics (lessons from the research session)

**Property-type classifier** (the guardrail that stops new-dev units ranking as flips):
- `erfSize == floorSize` → sectional/new-dev tell (e.g. 40 m²/56 m² "houses").
- Description tokens: `estate`, `new phase`, `now selling`, `units`, `development` → new-dev.
- Presence of monthly **levy** + recent listing date + several **identical-price siblings**
  in the same complex → new-dev sold unit-by-unit, not a resale house.
- Title type `Sectional` / `Sec Title` → exclude from flip ranking (flag as sectional).

**Data-quality normalisation** (real dirt seen this session):
- Nonsense erf values (e.g. `100 000 m²`, `16 777 m²` on a flat) → clamp/flag, don't score.
- **Price ranges** (auction "R400k–R800k") → store min/max, use expected/reserve for scoring.
- `cash only`, `no approved building plans` → raise `effort`, lower buyer pool, tag risk.
- `Under Offer` / `In Transaction` → status-flag; down-rank or hide, don't present as buyable.

## 6. Architecture (grounded in HOV)

```
                 ┌─────────────────────────────────────────────┐
  Daily 04:00 →  │ Azure Function (Python) timerTrigger         │
                 │  ingest → normalize → dedupe → score → write │
                 └───────────────┬─────────────────────────────┘
                                 │ BaserowClient (shared/utils.py)
                                 ▼
                 ┌─────────────────────────────────────────────┐
                 │ Baserow table: deal_radar_listings          │
                 │  (facts + sub-scores + provenance + lastSeen)│
                 └───────────────┬─────────────────────────────┘
                                 │ read (cached)
                                 ▼
     Next.js API route  app/api/radar/route.ts  (public, ISR/edge-cached)
                                 │
                                 ▼
     Public page  app/radar/page.tsx  (unauth; client-side weighting UI)
                                 │  links out ↗
                                 ▼
                    Source listing on Property24 / PP / MyRoof
```

- **Ingestion:** new timer function `DealRadarRefresh` (`schedule: "0 0 4 * * *"` = daily
  04:00 UTC), same shape as `RecurringTasks`, writing to a new Baserow table via the
  existing `BaserowClient`. Idempotent upsert keyed on `sourcePortal + listingId`.
- **Storage:** Baserow (operational DB already in stack). Table `deal_radar_listings`.
- **API:** `app/api/radar/route.ts`, public, returns normalized rows; heavily cached
  (revalidate ~1h). No auth wrapper (unlike `withRole()` routes).
- **Page:** `app/radar/page.tsx`, added to public-paths allowlist (same class as
  `kiosk`). Client component for the weighting sliders + live re-rank; SSR the initial
  list for SEO/first paint.
- **Data mode:** respect HOV convention — empty unless the table is populated; behind a
  `RADAR_ENABLED` flag so it ships dark.

## 7. Daily auto-update mechanism (detail)

1. **Trigger:** timer cron daily 04:00 UTC.
2. **Fetch:** per chosen data source (§3) pull current candidate set for configured areas.
3. **Normalize:** map to the schema; classify `propertyType` (reject/flag new-dev units);
   compute derived fields (`renoCostEstimate`, `flipPct`, `dealScore`, sub-scores).
4. **ARV/comps refresh:** recompute suburb median + done-up ARV, **preferring sold/transfer
   prices** over asking comps; store `arvBasis` + `arvConfidence`.
5. **Dedupe & upsert:** two levels — within-portal on `sourcePortal+listingId`, and
   **cross-portal on `canonicalKey`** (address+erf+geo) so one house = one record, many
   sources; update `lastSeen`.
6. **Delisting / status:** rows not seen for N days → `status: delisted`; detect
   `Under Offer` / `In Transaction` and down-rank or hide.
7. **Change log:** price drops / status changes recorded (powers "reduced" + alerts).
8. **Observability:** log counts, failures; alert on zero-rows / source-shape change.
9. **Idempotent + resumable:** a re-run same day is a no-op beyond `lastSeen`.

## 8. Feature set

### MVP (v1)
- Public ranked list with live weighting. The three drivers (effort / flip % / buy-in) are
  the headline sliders; the rest of §5's dimensions are weightable via an "advanced" panel
  and available as filters, so v1 carries the full dimension set (not a reduced cut).
- Per-card: price, suburb, erf, property type, distress flag, confidence badge, deal
  score, **link out** to source, `lastSeen` date.
- Filters: area, price band, property type (freehold-only toggle), distress-only,
  erf-size min, exclude "Under Offer".
- Honesty UI: confidence badge, "estimate" markers on ARV/flip, data-provenance line.
- Legal footer: source attribution, "not financial advice", ToS-safe framing.

### v2
- **Email/WhatsApp deal alerts** (reuse HOV notification-service / ACS + Twilio) — "new
  ≥15% under-median freehold in your areas". (Alerts require capturing an email →
  triggers POPIA consent; may cross the public/unauth boundary — see open decisions.)
- **Saved weightings & watchlist** (still client-side, shareable via URL-encoded state).
- **Map view** (erf + proximity + dolomite/flood overlay).
- **Comparable / ARV drill-down** per listing.
- **Repossessed/auction calendar** (SIE / Pre-Hammer dates).

### v3
- Multi-area / any-SA-town config.
- Licensed feed (Option A) behind same schema.
- Admin curation console (approve/verify rows, override scores) — authenticated.

## 9. Other things we need (often forgotten)

- **Compliance/attribution page** — sources, refresh cadence, disclaimer.
- **Data provenance on every row** — portal + URL + `lastSeen` + confidence.
- **Rate limiting + caching/CDN** on the public route (abuse + cost control).
- **POPIA** — only relevant once we collect emails for alerts; consent + purpose.
- **SEO / OG tags** — it's a public page; make it findable & shareable.
- **Empty & error states** — HOV convention: empty unless configured, no fake demo data.
- **Monitoring** — ingestion health, source-shape drift, zero-row alarm.
- **Kill switch** — `RADAR_ENABLED` flag to disable instantly if a source objects.

## 10. Compliance & risk

- **ToS/copyright:** store facts + link out; never mirror descriptions/photos (Option
  B/C). Attribute sources. Honor takedown/kill-switch.
- **Not financial advice** disclaimer (mirrors the global rule against personalised
  investment advice).
- **Physical-risk data** (dolomite/flood) is indicative, not a survey — label as such.
- **Mission fit:** this is off HOV's estate-management core. Placement decision below.

## 11. Testing

- Unit: scoring rubric (each dimension → sub-score), composite math, within- and
  **cross-portal dedupe** (`canonicalKey`), property-type classifier (must reject new-dev
  units via the §5.3 tells), ARV-basis preference (sold > asking), data-quality clamps
  (nonsense erf, price ranges, cash-only), delisting/status logic. (Vitest.)
- API: `app/api/radar` returns shape, is uncached-safe, no PII. (tests/api.)
- E2E: public page loads unauth, sliders re-rank, links out, empty state. (Playwright.)
- Ingestion: golden-file normalize test against captured source fixtures.

## 12. Rollout / phasing

1. Approve this spec + resolve open decisions.
2. Baton epic + tasks under `house-of-veritas` project.
3. Schema + scoring lib + tests (data layer) → veritas-ledger / TESTING.
4. Ingestion function (dark, flag-off) → seed with the ~9 verified Springs listings.
5. Public page + API + weighting UI → FRONTEND.
6. Compliance/attribution + disclaimers → SECURITY/DOCS.
7. Enable flag for Springs; measure; then v2.

## 13. Decisions (resolved)

1. **Data source:** ✅ **B+C agent-curated, run autonomously** (§3 + §3.1) — facts + link-out,
   automated QA gate, human on exception only. Schema built feed-agnostic so a **licensed
   feed (A)** drops in at v3 to erase even exception handling. No hard-scrape.
2. **Placement:** ✅ `/radar` path on the HOV app now; extractable to its own app later.
3. **Area scope v1:** ✅ Springs only.
4. **Alerts:** ✅ v2 (deferred; email capture handled under POPIA when it lands).
5. **Dimensions:** ✅ **Full expanded set from §5 in v1** (not a reduced cut) — all raw
   fields + sub-scores; `confidence` shown, never scored.

---

### Appendix A — seed dataset (verified this session)
The ~9 Springs listings already read and scored (Geduld 2-for-1, Geduld EasySell repo,
Struisbult dated 1,420 m², Springs SIE, Strubenvale fixer+flat, Selection Park +flatlet,
Modder East cash-only, Modder East EasySell, Strubenvale 6-bed) seed the table so v1
launches non-empty.
