# canonicalKey Dedupe — Spike Findings (Radar 2)

- **Status:** Spike complete → implementation landed (pure functions, tests green).
- **Spec:** `property-deal-radar.md` §5.2 (canonicalKey matching), §5.3 (dedupe
  heuristics), §3.1 (QA quarantine queue), Appendix A (9 verified Springs seeds).
- **Code:** `lib/services/radar/canonical-key-match.ts`
- **Fixtures / measurement set:** `tests/lib/services/radar/_radar2-fixtures.ts`
- **Tests:** `tests/lib/services/radar/canonical-key-match.test.ts`

## 1. Problem

Collapse the **same physical house** listed across portals/days into one record
**without silent false-merges**. Portals routinely hide the street address
("contact agent for address"), so exact-address match fails on most rows. §5.2
gives two strategies; the spike's job is to measure the **false-merge rate** and
recommend a confidence threshold before any of this is wired into ingest.

## 2. Approach

Two pure matching strategies over an identity projection of a listing
(`MatchCandidate` = suburb, erf, bedrooms, price, optional geohash, agent/agency,
propertyType):

1. **Address/geo present** → `geohash + erf-bucket` exact key, reusing the Radar 1
   deterministic normaliser `computeCanonicalKey`. Equal key on two freehold rows
   ⇒ `merge` (confidence 1.0). Live geocoding is **out of scope** for the spike
   (no network) — the fixture supplies a pre-computed geohash; real geocoding is
   deferred to ingest (Radar 3).
2. **Address hidden (common)** → **fuzzy composite** weighted score, NOT a boolean:

   | Feature | Weight | Full credit when… |
   |---|---:|---|
   | erf (±tol) | 0.30 | within 50 m² (half within 100 m²) |
   | bedrooms | 0.20 | equal (¼ credit for a 1-bed wobble) |
   | price-band | 0.25 | within 2% (half within 8%) |
   | agent / agency | 0.25 | agency or agent name matches |

   **Suburb is a hard gate** (mismatch ⇒ confidence 0, `separate`).

The three **positional** features sum to **0.75** — deliberately below the merge
bar — so two address-hidden houses can **never** auto-merge on position alone; an
**identity corroborator** (agent match, or a shared geohash) is structurally
required to clear the bar. This is the core anti-false-merge property.

Output is a decision enum — **`merge` / `quarantine` / `separate`** — plus the
confidence and the reasons that fired.

### False-merge guards (override the score)

- **New-dev / sectional sibling guard (§5.3):** identical-price units in one
  complex look identical on every fuzzy field. If **both** rows are
  sectional/new-dev ⇒ `separate` (different units); if **exactly one** is flagged
  ⇒ `quarantine`. Non-flip units therefore **never auto-merge** on fuzzy signals.
- **Geohash + sectional:** units share a building footprint, so a geohash match on
  a sectional row is `quarantine`, not `merge`.
- **Bedroom hard-diff:** a ≥2-bedroom gap can never `merge`.

## 3. Measurement — Springs seed set

11 ground-truth-labelled pairs built from the Appendix A seeds: **5 same-house**
(cross-portal dups, incl. a geohash pair and a no-agent pair) and **6
different-house** (new-dev siblings, similar-but-different houses, a sectional
unit pair, and one *irreducible* trap). Per-pair confidences:

| Pair | Same house? | Confidence | Strategy | Decision @0.85 | Why it's interesting |
|---|:--:|--:|---|---|---|
| P1 | yes | 1.000 | fuzzy | merge | cross-portal dup, agency corroborates |
| P2 | yes | 1.000 | fuzzy | merge | repossession, cross-portal, price-drop lag |
| P3 | yes | 1.000 | geohash | merge | address shown both sides |
| P4 | yes | 0.875 | fuzzy | merge | price drop → half price match; agent saves it |
| P5 | yes | 0.750 | fuzzy | **quarantine** | address **and** agent hidden → positional only |
| N1 | no | 1.000 | fuzzy | **separate** | new-dev siblings (§5.3) — guard overrides |
| N2 | no | 0.750 | fuzzy | **quarantine** | similar houses, **different** agency |
| N3 | no | 0.350 | fuzzy | separate | different beds + price |
| N4 | no | 0.450 | fuzzy | separate | erf far apart |
| N5 | no | 0.700 | geohash | **quarantine** | sectional units share footprint |
| N6 | no | 1.000 | fuzzy | **merge** ⚠ | **irreducible** — identical fuzzy fields, same agency |

### Threshold sweep (merge threshold varied; quarantine floor fixed at 0.60)

| Merge threshold | True merges (of 5) | **False merges** (of 6) | Missed merges | Quarantined |
|---:|:--:|:--:|:--:|:--:|
| 0.60 | 5 | **2** | 0 | 1 |
| 0.70 | 5 | **2** | 0 | 1 |
| 0.75 | 5 | **2** | 0 | 1 |
| **0.80** | 4 | **1** | 1 | 3 |
| **0.85** | 4 | **1** | 1 | 3 |
| 0.90 | 3 | **1** | 2 | 4 |
| 0.95 | 3 | **1** | 2 | 4 |

"Missed" = a real dup sent to quarantine instead of auto-merged (safe: a human
still reconciles it — nothing is lost, just not automatic).

The false-merge count splits into two kinds:

- **Threshold-tunable (N2):** two genuinely different houses with near-identical
  position but **different agencies** score 0.75. Below **0.80** they false-merge;
  at ≥0.80 they drop to `quarantine`. This is the reason **not to go below 0.80**.
- **Irreducible (N6):** two different freehold houses that share suburb + erf +
  bedrooms + price **and** agency, both address-hidden, score **1.0**. **No fuzzy
  threshold catches this** — raising the bar to 0.95 does not help. Only a real
  address / geocode (Radar 3) distinguishes them.

Among the pairs fuzzy features *can* distinguish, the false-merge rate is **0 at
any threshold ≥0.80**.

## 4. Recommendation — merge threshold = **0.85** (quarantine floor 0.60)

Rationale:

1. **Structural safety.** The positional-only ceiling is 0.75, so 0.85
   *guarantees* an identity corroborator (agent match or geohash) is present
   before anything auto-merges. Position alone is never enough.
2. **Eliminates the tunable false merge.** N2 (different-agency lookalikes) is
   gone at ≥0.80; 0.85 adds a safety margin above the 0.75 lookalike cluster so
   small future scoring changes won't tip it into a merge.
3. **Keeps real dups automatic.** 0.85 still merges P4 — a legitimate cross-portal
   dup with a small price drop (0.875) — which 0.90/0.95 would needlessly demote
   to the quarantine queue, adding human load for no false-merge benefit.
4. **"Never silently merge" holds.** Marginal same-house pairs that lack a
   corroborator (P5, no agent) correctly fall to `quarantine`, not `merge`.

**Residual false-merge rate at 0.85:** 1 / 6 different-house pairs (the N6
irreducible case). This is the explicit, measured motivation for Radar 3 live
geocoding — it is not fixable by tuning the threshold or by the quarantine queue
(N6 scores a confident 1.0).

### Decision boundaries (as shipped)

```
confidence ≥ 0.85 ................ merge      (unless a guard overrides)
0.60 ≤ confidence < 0.85 ......... quarantine (QA exception review, §3.1)
confidence < 0.60 ................ separate

guards (override the score):
  both sectional/new-dev ................. separate  (siblings, §5.3)
  one sectional/new-dev .................. quarantine
  geohash-exact but a side sectional ..... quarantine (shared footprint)
  bedroom gap ≥ 2 ........................ never merge
  suburb mismatch ........................ separate
```

## 5. Handling the address-hidden case (the common path)

- The **fuzzy composite** runs whenever a geohash is absent on either side.
- Because positional features cap at 0.75, an address-hidden pair **cannot
  auto-merge** without an agent/agency corroborator. With one it can reach 0.85+
  (P1, P2, P4). Without one it lands in `quarantine` (P5) — surfaced to a human,
  never silently merged.
- Genuinely different lookalikes are separated by the **agent mismatch** (N2 →
  quarantine) or by **erf / bedroom / price** disagreement (N3, N4 → separate).

## 6. Deferred to Radar 3 (explicitly out of scope here)

- **Live geocoding** (address → geohash) at ingest. The matcher already consumes a
  pre-computed geohash and prefers the exact geo path; wiring the geocoder is
  Radar 3. This is the only mitigation for the irreducible N6 false-merge.
- **Ingest wiring / DB writes.** `matchCandidates` and `findCandidateMatches` are
  pure; Radar 3 calls `findCandidateMatches(newRow, existingBlockingGroup)`,
  applies the returned decisions (merge into the record's source list, push
  `quarantine` rows to the §3.1 review queue, keep `separate` rows distinct), and
  persists. No merge is performed inside this module.
- **Blocking at scale.** `computeFuzzyCandidateKey` gives an O(1) blocking key
  (suburb + erf bucket + bedrooms + price band) so Radar 3 only scores plausibly
  related rows rather than all-pairs.
- **Threshold re-calibration on live volume.** 0.85 is tuned on the 9-seed set;
  Radar 3 should re-run this sweep once real cross-portal volume exists and adjust
  if the false-merge/quarantine trade shifts.

## 7. Known limitation surfaced by the spike

erf bucketing (50 m² width, inherited from Radar 1) is **boundary-sensitive**: two
captures of the same stand that straddle a bucket edge (e.g. 1420 vs 1435 m²) can
produce different geo keys and miss an otherwise-exact geohash match. In the fuzzy
path this is softened by the ±tolerance scorer, but the geo key itself is exact.
Radar 3 should consider overlapping buckets or a small ± search on the geo key.
