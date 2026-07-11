# Property Deal Radar — Kill-switch (`RADAR_ENABLED`) & POPIA Boundary Note

- **Status:** DRAFT — semantics & boundary definition. No flag is set or changed here.
- **Owner:** Jurie
- **Author:** agent session (springs-cheapest-properties — Radar 5, Compliance)
- **Parent spec:** `property-deal-radar.md` (§6 data mode, §9 kill switch, §9 POPIA, §8 v2 alerts)
- **Scope:** Defines what the `RADAR_ENABLED` kill-switch means and where the POPIA boundary sits.
  Documentation only — **this workstream does not add, set, or flip any flag or touch code.**

> The `RADAR_ENABLED` flag does not yet exist in `.env.example`. Adding it belongs to the
> data-layer / flag work (Radar 4/6), not to this compliance track. This document specifies the
> intended behaviour so that whoever wires it implements it correctly, and so the legal sign-off
> (`property-deal-radar-legal-signoff.md`) can reference concrete semantics.

---

## 1. `RADAR_ENABLED` semantics

`RADAR_ENABLED` is the feature's compliance kill-switch. It follows HOV's "ships dark, empty unless
configured" convention (spec §6; CLAUDE.md Data Mode).

| State | Meaning |
|---|---|
| **unset / `false`** (default) | Radar ships **dark**. Ingestion does not publish to the public path; the public `/radar` route serves an empty/disabled state. This is the default at all times until a signed sign-off flips it. |
| **`true`** (Springs, post-sign-off only) | Radar publishes and the public page serves ranked rows for the configured area (Springs). May only be set after the sign-off block in `property-deal-radar-legal-signoff.md` §5 is completed by humans. |

Required behaviour when wired (Radar 4/6):

- **Ships dark.** Default (unset/`false`) = disabled. No demo/fallback rows appear implicitly; this
  is not "demo mode" (that is `ALLOW_DEMO_DATA`, a separate flag — do not conflate).
- **Disables publish instantly.** Flipping to `false` MUST stop publication effectively immediately
  (next request / next cache revalidation), without a redeploy. The public route reads the flag at
  request time (or via short-TTL cache) so an objection or takedown can be honoured fast.
- **Ingestion respects it.** With `RADAR_ENABLED=false`, the ingestion job does not write to the
  published path (ingestion-compliance-spec AC-15) — at most it writes to quarantine.
- **Read-time gate on the API + page.** `app/api/radar/route.ts` and `app/radar/page.tsx`
  (spec §6) both check the flag; when off, they return the empty/disabled state, not stale rows.
- **No agent may set it.** Enabling for Springs is a human action gated on legal sign-off. No agent,
  script, or automated step may flip `RADAR_ENABLED=true`.

Kill-switch triggers (any of): a portal objection, a takedown request (compliance page §6), a
source-shape-drift or anomaly alarm the team can't immediately clear, or legal advice to pause.

## 2. POPIA boundary

**v1 is out of POPIA scope — deliberately, and only because it collects no personal information.**

- **v1 (this launch):** public, unauthenticated, no login. Weightings live in `localStorage`
  client-side (spec §4). Radar processes **property listing facts**, not personal information about
  identifiable data subjects. No emails, names, phone numbers, or accounts are collected or stored.
  Therefore POPIA processing obligations (consent, purpose limitation, retention, data-subject
  rights) are **not engaged** by v1. This must remain true for the sign-off to hold (see
  `property-deal-radar-legal-signoff.md` §4 Q10).

  - Caveat to confirm at sign-off: agent contact names / agency names that may appear in listing
    facts or `canonicalKey` matching (spec §5.2) could constitute personal information about an
    identifiable individual. Flag for the reviewer: decide whether agent names are displayed/stored
    and whether that crosses into PI. Default posture: do not surface agent personal details on the
    public page beyond what attribution strictly requires.

- **v2 (deferred — email/WhatsApp deal alerts, spec §8):** the moment Radar captures an email (or
  phone) to send alerts, it collects **personal information** and **POPIA is engaged**. That triggers,
  at minimum: lawful basis / consent capture, purpose limitation (alerts only), a privacy notice,
  retention + deletion policy, unsubscribe/opt-out, and data-subject request handling. This crosses
  the public/unauth boundary and is explicitly **out of scope for v1** (spec §13 decision 4).

**Boundary line:** POPIA is not engaged **until the first piece of personal information is
collected**. v1 must not collect any. When v2 alerts are designed, POPIA compliance is a required
gate for *that* release — a separate sign-off, not covered by the v1 legal sign-off.

## 3. Relationship to other gates

- The kill-switch is mitigation **M6** in the residual-risk memo and acceptance criterion **AC-15**
  in the ingestion spec.
- "Kill-switch verified to disable publish instantly" is a checkbox in the sign-off block
  (`property-deal-radar-legal-signoff.md` §5) — it must be demonstrably true before Springs go-live.

## 4. Cross-references

- Legal sign-off & residual risk: `property-deal-radar-legal-signoff.md`
- Ingestion adherence (AC-15 kill-switch honour): `property-deal-radar-ingestion-compliance-spec.md`
- User-facing takedown path that can trigger the switch: `property-deal-radar-compliance.md` §6
- Parent spec: `property-deal-radar.md` (§6, §8 v2, §9)
