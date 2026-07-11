# Property Deal Radar — Legal Sign-off Checklist & Residual-Risk Memo

- **Status:** OPEN — legal sign-off NOT obtained. This document is the material a human
  lawyer/owner reviews and signs. **This gate blocks Radar 6 (go-live / flag-on for Springs).**
- **Owner:** Jurie (business owner / accountable person)
- **Sign-off authority:** a qualified attorney (SA ToS/IP/POPIA) **and** the business owner. An
  agent CANNOT provide, substitute for, or represent this sign-off.
- **Author:** agent session (springs-cheapest-properties — Radar 5, Compliance)
- **Parent spec:** `property-deal-radar.md` (§3, §3.3, §10 — source of truth)

> ⚠️ **Explicit gate.** `RADAR_ENABLED` must NOT be flipped on for Springs until the sign-off
> block in §5 of this document is completed and dated by a human. No agent may set that flag, and
> no agent output constitutes legal approval. Radar 6 depends on this document being signed.

---

## 1. What we are actually doing (stated plainly for the reviewer)

Property Deal Radar runs an automated daily job (04:00 UTC) that **programmatically accesses**
public listing pages on Property24, Private Property and MyRoof, extracts **structured facts only**
(price, beds/baths, erf/floor, property type, suburb, listing date, source URL), normalises and
scores them, and publishes a public ranked page that **links out** to each source listing. It does
**not** store or display listing descriptions or photographs. This is spec Option **B+C**
(agent-curated facts + metadata/deep-link), run autonomously with an automated QA gate; the
headless-scrape option (D) is rejected.

## 2. Residual-risk honesty (spec §3.3 — do not soften this)

The chosen approach **reduces but does not eliminate** legal risk. The reviewer must understand:

1. **Access itself may breach ToS regardless of what we store.** Even "facts + link-out" *accesses*
   portal pages by machine. Some portal Terms of Service prohibit automated access / scraping
   **irrespective** of whether the retrieved content is copyrighted or stored. Storing only
   non-copyrightable facts addresses the *copyright* risk; it does **not** by itself address the
   *breach-of-contract / ToS* risk from the access.
2. **"Facts are not copyrightable" is a defence, not a shield against everything.** Price, erf, beds
   are facts; a portal's *compilation*, *database*, and *presentation* may still attract protection,
   and their ToS is a separate contractual layer.
3. **Low volume + attribution + link-out are mitigations, not immunity.** They make the posture
   defensible and reduce the chance and severity of objection; they do not make it certainly lawful.
4. **The clean end-state is a licensed feed (Option A).** Lightstone / PropertyFox / Deeds Office /
   portal partner API is the only path that is simultaneously automated **and** contractually clean.
   Treat it as the target, not a "nice to have" (spec §3, §3.3).

**Bottom line for the owner:** proceeding on B+C is a deliberate, eyes-open acceptance of a residual
grey-zone risk, mitigated as below, and reversible instantly via the kill-switch. It is a business/
legal risk decision, not a technical one — which is why it needs a human signature.

## 3. Mitigations in place (what reduces the risk)

| # | Mitigation | Where implemented / specified |
|---|---|---|
| M1 | Honour `robots.txt` on every portal access | `property-deal-radar-ingestion-compliance-spec.md` (AC-1..AC-4); Radar 3 (ingestion) |
| M2 | Throttle / rate-limit; low request volume; off-peak (04:00 UTC) | ingestion-compliance-spec AC-5..AC-8; Radar 3 |
| M3 | Facts only — never mirror descriptions or photos | spec §3, §10; ingestion + compliance page |
| M4 | Attribute every row (portal + deep link) + `lastSeen` + confidence | `property-deal-radar-compliance.md` §4; spec §5, §9 |
| M5 | Public takedown / contact path, monitored | `property-deal-radar-compliance.md` §6 |
| M6 | Kill-switch `RADAR_ENABLED=false` disables publish instantly | `property-deal-radar-killswitch-popia.md`; spec §6, §9 |
| M7 | Ships dark; Springs-only, ~9 seed rows — small blast radius | spec §12, §13, Appendix A |
| M8 | Licensed feed (Option A) roadmapped as clean end-state | spec §3 Target, §8 v3 |
| M9 | "Not financial advice" + indicative-risk disclaimers | `property-deal-radar-compliance.md` §5; spec §10 |
| M10 | No PII collected in v1 (no login, weightings client-side) | spec §4, §6; POPIA boundary below |

## 4. Open questions a lawyer MUST answer before Springs go-live

These are the questions the sign-off turns on. Each needs a written answer from the reviewing
attorney; "unknown" is not a pass.

1. **ToS — access clause.** Do the current Property24 / Private Property / MyRoof Terms of Service
   prohibit automated access / scraping *per se*, independent of what is stored or republished? If
   yes, does honouring robots.txt + low volume + link-out materially change the analysis, or is any
   automated access a breach?
2. **Facts vs compilation.** Is extracting and republishing only factual fields (price, erf, beds,
   suburb, date) defensible under SA copyright law given the portals' database/compilation rights?
   Where is the line between "facts" and their protected compilation?
3. **Deep-linking / attribution.** Is deep-linking to source listings with attribution permitted, or
   do any of the portals' terms bar linking/framing in a way that affects us?
4. **Robots.txt as legal signal.** In SA, does honouring/ignoring robots.txt carry contractual or
   evidential weight? (It is a mitigation; confirm its legal status so we don't over-rely on it.)
5. **Distress/bank tags (MyRoof).** Any additional constraints around republishing bank-programme /
   distress indicators (EasySell / SIE / Pre-Hammer) or seller-distress information?
6. **Liability from scores/notes.** What is our exposure if a user relies on a score, ARV estimate,
   or AI `analystNote` and loses money? Does the "not financial advice" disclaimer (compliance page
   §5) adequately cap this, and is the wording sufficient under SA consumer-protection law (CPA)?
7. **Physical-risk statements.** Is the dolomite/flood "indicative, not a survey" disclaimer enough
   to avoid liability for publishing area-level risk flags on specific stands?
8. **Takedown obligations.** What response time / process must the takedown path commit to, to be
   defensible? Any statutory notice-and-takedown regime (e.g. ECTA) we should map onto?
9. **Risk appetite / go/no-go.** Given the above, is B+C acceptable to launch on for Springs now, or
   must we wait for a licensed feed (Option A)? If go, under what conditions (volume cap, source
   allowlist, review cadence)?
10. **POPIA trigger point.** Confirm v1 collects no personal information and is out of POPIA scope,
    and define exactly what changes the moment v2 alerts capture emails (see
    `property-deal-radar-killswitch-popia.md`).

## 5. Sign-off block (human completes — required before Radar 6)

Radar 6 (enable `RADAR_ENABLED` for Springs) is **BLOCKED** until every box below is checked and the
signatures/date are filled in by humans. Leaving any box unchecked = not signed off = do not enable.

- [ ] Attorney has reviewed §1–§4 and provided written answers to all ten open questions (§4).
- [ ] The residual-risk position (§2) is understood and accepted by the business owner.
- [ ] Mitigations M1–M10 (§3) are confirmed implemented (Radar 3 ingestion + Radar 4/6 flag + compliance page live).
- [ ] `robots.txt` + rate-limit acceptance criteria (`property-deal-radar-ingestion-compliance-spec.md`) verified as met by Radar 3.
- [ ] Compliance/attribution page content (`property-deal-radar-compliance.md`) is live on `/radar` incl. disclaimers + takedown path.
- [ ] Kill-switch verified to disable publish instantly (`property-deal-radar-killswitch-popia.md`).
- [ ] Launch conditions from Q9 (source allowlist, volume cap, review cadence) are documented and in place.
- [ ] Go/no-go decision recorded: ______ (GO / NO-GO)

| Role | Name | Signature | Date |
|---|---|---|---|
| Reviewing attorney (SA ToS/IP/POPIA) | | | |
| Business owner (accountable) | Jurie | | |

**Until this block is signed, `RADAR_ENABLED` stays `false`/unset. No agent may change it.**

## 6. Cross-references

- Compliance/attribution content: `property-deal-radar-compliance.md`
- Ingestion robots.txt / rate-limit acceptance criteria: `property-deal-radar-ingestion-compliance-spec.md`
- Kill-switch + POPIA boundary: `property-deal-radar-killswitch-popia.md`
- Parent spec: `property-deal-radar.md`
