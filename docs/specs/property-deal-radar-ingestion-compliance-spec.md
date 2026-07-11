# Property Deal Radar — Ingestion robots.txt & Rate-Limit Adherence Spec

- **Status:** DRAFT — acceptance criteria for the Radar 3 ingestion function. Not implemented here.
- **Owner:** Jurie
- **Author:** agent session (springs-cheapest-properties — Radar 5, Compliance)
- **Parent spec:** `property-deal-radar.md` (§3.2 extraction principles, §3.3 residual risk, §6, §7)
- **Implements against:** the `DealRadarRefresh` Azure Function (Python timerTrigger, spec §6) — **Radar 3, not this workstream.**
- **Scope:** Defines what the ingestion job MUST honour when accessing source portals. Written as
  testable acceptance criteria so Radar 3 can implement and TESTING can verify. **No app code here.**

> These are compliance *requirements*, not implementation. Radar 3 owns the code; this document is
> the contract it must satisfy. Meeting every AC below is a prerequisite item in the legal sign-off
> checklist (`property-deal-radar-legal-signoff.md` §5).

---

## 1. Principle

Radar accesses source portals **programmatically for structured-fact extraction only**, and does so
as a well-behaved client: it respects `robots.txt`, throttles aggressively, identifies itself,
stays low-volume, and fails safe. This mirrors `lib/services/marketplace-service.ts`: compliant
path first, deep-link fallback, **never a raw crawl** (spec §3, Option D rejected).

## 2. robots.txt adherence — acceptance criteria

- **AC-1 — Fetch and honour.** Before accessing any path on a source host, the job MUST fetch and
  parse that host's `robots.txt` and obey its `Disallow`/`Allow` rules for the job's user-agent.
- **AC-2 — Disallowed = skip.** If `robots.txt` disallows a path the job would fetch, the job MUST
  NOT fetch it. It logs the skip and continues; it does not attempt a workaround.
- **AC-3 — Cache with TTL.** `robots.txt` is fetched at most once per host per run (cache for the
  run, TTL ≤ 24h) to avoid hammering the robots endpoint itself.
- **AC-4 — Fail-closed on ambiguity.** If `robots.txt` cannot be fetched/parsed, or its meaning is
  ambiguous for a path, the job treats that path as **disallowed** for this run (fail closed), logs
  it, and — if this blocks the whole source — raises a source-shape-drift alarm rather than
  guessing.
- **AC-4b — Crawl-delay respected.** If `robots.txt` specifies a `Crawl-delay`, the job MUST use the
  greater of that value and the configured throttle (AC-5).

## 3. Rate-limiting & politeness — acceptance criteria

- **AC-5 — Minimum inter-request delay.** The job enforces a configurable minimum delay between
  requests to the same host (default target ≥ 2–5s; final value confirmed at sign-off). No burst
  parallelism against a single host.
- **AC-6 — Per-host concurrency = 1.** At most one in-flight request per source host at a time.
- **AC-7 — Daily volume cap.** A configurable max requests-per-host-per-run cap (sized to the small
  Springs area set, ~9 seed rows + area listing pages). Exceeding the cap stops that host's run and
  logs it; it does not "try harder".
- **AC-8 — Off-peak schedule.** Runs on the daily 04:00 UTC timer (spec §6/§7). No ad-hoc
  high-frequency re-runs; a same-day re-run is idempotent and adds no meaningful extra load
  (spec §7.9).
- **AC-9 — Timeouts.** Every outbound request uses an explicit timeout (align with HOV convention —
  external calls are time-bounded; cf. `AbortSignal.timeout()` in TS services). No unbounded hangs.
- **AC-10 — Backoff on throttle signals.** On HTTP 429 / 503 / `Retry-After`, the job backs off
  (honours `Retry-After` when present, else exponential backoff) and, if the source keeps refusing,
  aborts that source for the run and alarms — it does NOT rotate IPs, spoof, or evade.

## 4. Identification & honesty — acceptance criteria

- **AC-11 — Honest User-Agent.** Requests send a stable, identifiable User-Agent that names the
  Radar bot and a contact URL/inbox (the same takedown/contact path as
  `property-deal-radar-compliance.md` §6). No impersonation of a normal browser to evade controls.
- **AC-12 — No anti-bot evasion.** The job MUST NOT use IP rotation, CAPTCHA-solving, header
  spoofing, cookie/session replay, or any technique whose purpose is to circumvent a portal's access
  controls. Hitting such a control = treat the source as disallowed for the run + alarm.
- **AC-13 — Facts only.** The job extracts only structured fields (price, beds/baths, erf/floor,
  type, suburb, listing date, source URL, distress tag). It MUST NOT store listing description prose
  or images (spec §3.2, §10). LLM prose summaries are never a source of truth (spec §3.2 principle 1).

## 5. Confidence, validation & fail-safe — acceptance criteria

- **AC-14 — Confidence gating.** A row is `verified` only if its source detail page was actually
  opened + parsed this run; otherwise it stays `feed` (spec §3.1.3, §5). Confidence never feeds the
  score.
- **AC-15 — Kill-switch honoured.** When `RADAR_ENABLED=false`, the ingestion job MUST NOT publish
  (see `property-deal-radar-killswitch-popia.md`). Ingestion either no-ops or writes only to
  quarantine; nothing reaches the public path.
- **AC-16 — Exception escalation, not silent retry.** robots.txt blocks, repeated throttling,
  source-shape drift, or takedown hits raise a human-facing alarm via the HOV notification-service
  (spec §3.1.5) instead of aggressive retrying.
- **AC-17 — Auditable compliance log.** Each run logs, per host: robots.txt outcome, request count
  vs cap, applied delay, any backoff/skip/abort events. Logs MUST NOT contain PII (v1 has none) and
  follow HOV structured-logging rules (no `console.log`; no leaking secrets). This log is the
  evidence the sign-off checklist (M1, M2) is actually being met in production.

## 6. Test hooks for TESTING (Radar 3 verification)

- Golden-file normalize test against captured source fixtures (spec §11) — no live portal calls in tests.
- Unit test: robots.txt parser obeys `Disallow`/`Allow`/`Crawl-delay`; fail-closed on parse error (AC-1..AC-4b).
- Unit test: throttle enforces min-delay and per-host concurrency = 1 (AC-5, AC-6) using fake timers.
- Unit test: 429/503/`Retry-After` triggers backoff then source-abort, never IP rotation (AC-10, AC-12).
- Unit test: `RADAR_ENABLED=false` ⇒ no publish path reached (AC-15).
- Unit test: unopened row stays `feed`, never auto-`verified` (AC-14).

## 7. Cross-references

- Residual risk & legal gate: `property-deal-radar-legal-signoff.md` (AC compliance is a sign-off item)
- User-facing attribution/disclaimers: `property-deal-radar-compliance.md`
- Kill-switch semantics: `property-deal-radar-killswitch-popia.md`
- Parent spec: `property-deal-radar.md` (§3.1 autonomous loop, §3.2 extraction principles, §6, §7)
