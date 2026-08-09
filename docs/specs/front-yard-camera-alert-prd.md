# PRD: Front-Yard Person Alert

**Status:** Ready to decompose into Baton tasks in the next session  
**Parent Baton task:** `2e4d5f5d-4a90-4099-9f97-d6059ac4b54c`  
**Related architecture:** [Camera Security and Governance Integration](camera-security-governance.md)  
**Device onboarding:** [JOOAN A2R-U Local Onboarding Runbook](jooan-a2r-u-local-onboarding-runbook.md)  
**Target:** One current front-yard camera, one responder (Charl), one alert rule

## 1. Outcome

When an informed test participant walks through the gate into the configured front-yard zone:

1. the locally running PhoenixVC Deck shows the real camera feed;
2. a local NexaMesh-backed detector identifies a `person` object without identifying the person;
3. Deck creates one deduplicated front-yard security event;
4. HOV persists the event and a hash-verifiable snapshot as reviewable evidence;
5. HOV notifies Charl to check the front yard; and
6. the notification opens a muted HOV live view that is available for two minutes and then stops.

The end-to-end path must continue to respect the primary architecture boundary: Deck owns the
camera, credentials, full-time stream, and local vision. HOV receives only the event, selected
evidence, and an expiring live session.

## 2. Product story

> As Charl, when a person enters the front yard while the security rule is armed, I want a prompt
> HOV alert with a trustworthy snapshot and a brief live view so I can check what is happening
> without exposing a permanent household-camera stream.

The alert means “a model observed a person-shaped object in this zone.” It does not mean the person
is an intruder, identify them, prove wrongdoing, or authorize an enforcement action.

## 3. The thinnest cake

Each slice must produce something independently demonstrable. Do not start by building a generic
camera marketplace, multi-camera orchestration, continuous cloud recorder, or broad vision platform.

### Slice 0 — Prove the wire

**Question:** Can the camera provide a local stream Deck can consume?

- Record make/model, firmware, camera LAN isolation, and local-account support.
- Enable and test ONVIF Profile T/S or RTSP locally.
- Capture the capability result: stream URI availability, codec, resolution, snapshot, PTZ, audio,
  event support, and camera-clock offset.
- Do not store the password or full RTSP URI in Baton, docs, logs, screenshots, or HOV.

**Demo:** A local diagnostic confirms one usable video profile or records an exact vendor-adapter
blocker.  
**Time box:** 2 hours.  
**Stop condition:** If neither ONVIF nor RTSP is available, choose a vendor adapter or replacement
camera before writing the viewer.

### Slice 1 — See

**Outcome:** Deck can show the real camera locally.

- Add a compiled camera-adapter interface in Deck; a marketplace/dynamic plugin loader is deferred.
- Implement only the adapter proven by Slice 0.
- Keep configuration, discovery, LAN endpoint, and credential reference in Deck.
- Store credentials in an OS-protected credential store; configuration stores only the reference.
- Add one camera alias, `front-yard`, one selected stream profile, reconnect/backoff, and health.
- Add a local privacy switch that immediately closes the stream.
- Keep audio, recording, HOV, and remote control off.

**Demo:** Start Deck, connect, view for ten minutes, stop with the privacy switch, restart Deck, and
reconnect without revealing credentials.  
**Accepted 2026-08-10:** The authentic camera rendered locally for more than ten minutes while Deck
remained responsive. Privacy changed the viewer immediately to black; reopening reconnected the
real feed. After a normal Deck shutdown and restart, the viewer defaulted to privacy-on and required
an explicit local open before reconnecting. Credentials remained in Windows Credential Manager;
audio, recording, HOV publishing, and remote access stayed disabled. No address, credential, full
URI, device identifier, or image evidence was promoted into project systems.  
**PR boundary:** Deck only.  
**Estimate:** 1–2 focused days after Slice 0.

### Slice 2 — Spot

**Outcome:** Deck labels a person entering a configured zone.

- Add a NexaMesh vision-adapter contract and one approved local/runtime implementation.
- Define a polygon named `front-yard-entry`; the user draws and saves it locally in Deck.
- Run only the `person` detector on a low-rate derived frame stream; do not send the full live stream
  to HOV.
- Display the current bounding box, confidence, model/deployment ID, and processing location.
- Confirm an event only after the configurable temporal rule passes. Recommended starting policy:
  confidence at least `0.75` in two frames within 1.5 seconds.
- Deduplicate detections under one event while a track remains in the zone and apply a five-minute
  notification cooldown after it leaves.
- Keep the rule in `observe` mode: on-screen event only, no HOV write or notification.

**Demo:** A person walks through the gate and Deck produces one local candidate event; an animal,
empty scene, and repeated frames do not create duplicate person events.  
**PR boundary:** Deck/NexaMesh adapter only.  
**Estimate:** 1–2 focused days once the callable NexaMesh runtime is identified.

### Slice 3 — Tell

**Outcome:** A synthetic or manually replayed Deck event reaches HOV and notifies Charl with a
snapshot.

- Pair one Deck instance to HOV with a one-time code and device-held signing key.
- Add a purpose-specific camera-event endpoint and persistent repository.
- Accept an event manifest plus one JPEG evidence snapshot using a private, short-lived upload grant.
- Preserve the original snapshot hash and store bounding-box/zone annotations separately.
- Resolve the responder from an admin-owned rule configuration whose initial value is Charl's stable
  HOV user ID. Do not address the alert using a display name, hard-coded email, or client-supplied
  recipient.
- Persist the event before dispatching notifications.
- Add a persistent HOV alert record and emit a real-time in-app update. The current notification
  service's `in_app` branch only returns a simulated-success receipt; that is not acceptance.
- Give Charl an alert card with time, camera alias, “person detected” wording, snapshot, confidence,
  acknowledgement, and `False alarm` / `Needs attention` review actions.
- Use one event ID as the idempotency key for ingest, evidence, notification, and review.

**Demo:** Replay a signed synthetic event twice; HOV stores one event, one evidence object, and one
Charl alert. Another user cannot read the snapshot.  
**PR boundary:** One Deck event-export PR and one HOV event/evidence/alert PR, linked by a versioned
fixture.  
**Estimate:** 2–3 focused days.

### Slice 4 — Open the brief window

**Outcome:** Charl's alert offers a muted, expiring live view.

- Add a pre-approved unattended-export rule scoped to `front-yard-entry + person + armed`.
- On the first accepted event, HOV creates a single-use incident lease with a 120-second effective
  duration. Make the default configurable from 30 to 120 seconds; hard-cap this rule at 180 seconds.
- Deck validates the signed lease and publishes a muted derived stream outbound to a selected
  WebRTC/WHIP relay. No router port is opened.
- The Charl alert deep-links to an authenticated HOV viewer. The viewer token is bound to Charl's
  user ID, event ID, camera alias, and lease expiry.
- Deck and HOV show the same countdown; Deck independently stops the publisher at expiry.
- Opening or refreshing after expiry shows the snapshot/event, not a renewed stream.
- Charl may revoke immediately. Extension is not included in this slice.
- The relay must not record, archive, or expose a reusable public URL.

**Demo:** Replay an event, open the alert as Charl, view live video, revoke once, then repeat and prove
automatic expiry plus reconnect denial.  
**PR boundary:** Relay adapter/Deck publisher plus HOV lease/viewer; use versioned contracts and
separate repo PRs.  
**Estimate:** 2–4 focused days after relay selection.

### Slice 5 — Walk through the gate

**Outcome:** The real, staffed end-to-end acceptance works once without bypasses.

- Arm the rule locally with a visible Deck indicator.
- Have an informed participant walk through the gate once.
- Record exact timestamps for camera frame, Deck candidate, Deck confirmed event, HOV receipt,
  evidence finalization, notification dispatch, Charl view open, and stream teardown.
- Charl acknowledges or marks the event false alarm.
- Verify bytes are private, the manifest digest matches, the live lease expires, and no duplicate
  alert appears after the cooldown window.
- Exercise camera offline, NexaMesh unavailable, HOV unavailable, and relay unavailable separately.
  Each failure is visible; none produces a false all-clear or endless stream.

**Demo:** One authentic gate walk produces one reviewable HOV alert with evidence and a two-minute
maximum live window.  
**PR boundary:** No feature expansion; fixes and evidence only.  
**Estimate:** Half a day when all preceding slices are deployed to the test environment.

## 4. Functional requirements

### Deck

- `FR-D1`: Deck is the only holder of camera credentials and LAN connection details.
- `FR-D2`: The camera remains locally viewable when HOV or the internet is unavailable.
- `FR-D3`: The front-yard zone, armed state, thresholds, cooldown, and responder rule are explicit
  configuration, not model prompt text.
- `FR-D4`: Detection produces `person` class, confidence, bounding box, track/time range,
  model/version, processing location, input hash, and privacy-mask version.
- `FR-D5`: Deck defaults to privacy mode on for a newly discovered camera until the owner enables
  live processing.
- `FR-D6`: Audio capture and talkback remain disabled for this workflow.
- `FR-D7`: The privacy switch stops decoding, inference, evidence creation, and live publishing.
- `FR-D8`: Event export and live publishing are outbound-only and idempotent.

### HOV

- `FR-H1`: HOV verifies the paired Deck signature and rejects stale, malformed, replayed, or
  cross-camera events.
- `FR-H2`: HOV stores receipt facts separately from Deck-claimed capture facts.
- `FR-H3`: Only configured authorized roles can change the rule or responder; Charl can read and
  review only alerts assigned to him unless a broader estate role explicitly permits access.
- `FR-H4`: Evidence bytes are private and resource-scoped; every view/download is audited.
- `FR-H5`: Notification persistence occurs before external delivery attempts.
- `FR-H6`: Duplicate ingest cannot create another evidence object, notification, or live lease.
- `FR-H7`: The viewer token and lease cannot outlive the effective expiry or be used by another user.
- `FR-H8`: Evidence review separates machine finding, human interpretation, and resulting action.

### NexaMesh

- `FR-N1`: NexaMesh is called through a versioned Deck adapter and cannot call HOV directly.
- `FR-N2`: Only the configured detector and necessary derived frames are supplied.
- `FR-N3`: Model unavailable, timeout, or below-threshold output is `inconclusive`, never `no person`.
- `FR-N4`: A model/deployment change resets the rule to observe mode until the regression corpus
  passes.

## 5. Non-functional targets

These are acceptance targets for a healthy local network, not promises before measurement.

| Target                                          | Initial threshold                                               |
| ----------------------------------------------- | --------------------------------------------------------------- |
| Camera-to-Deck local live latency               | Under 2 seconds                                                 |
| Confirmed person event after threshold frames   | Under 3 seconds from first qualifying frame                     |
| HOV receipt after Deck confirms                 | Under 5 seconds when online                                     |
| Charl alert visible                             | Under 10 seconds from confirmation                              |
| Live playback after Charl opens an active alert | Under 5 seconds                                                 |
| Duplicate alerts                                | One event/notification per continuous track and cooldown window |
| Incident live duration                          | 120 seconds default, 180 seconds hard cap                       |
| Camera credentials in HOV/logs                  | Zero                                                            |
| Face identity/biometric templates               | Zero                                                            |

## 6. Evidence and retention

The thinnest evidence is one original JPEG snapshot plus a signed manifest and separate annotation
JSON. MP4 event clips are a later enhancement; they are not required to prove the first cake.

- The snapshot is captured at or immediately after event confirmation.
- Deck hashes the original bytes before annotation or resizing.
- HOV verifies the uploaded object hash and preserves the original privately.
- The UI may render an annotated derivative, but it must link back to the immutable original digest.
- Recommended initial retention is 30 days for unreviewed/false-alarm events, subject to the estate's
  approved privacy policy. `Needs attention` may be promoted to a separately owned case retention
  policy.
- Deletion removes object bytes and leaves an auditable tombstone. A hold requires reason, owner, and
  review date.

## 7. Safety and abuse cases

| Risk                                   | Required control                                                      |
| -------------------------------------- | --------------------------------------------------------------------- |
| Notification spam from repeated frames | Track/event idempotency plus cooldown                                 |
| False person detection                 | Multi-frame threshold, observe mode, Charl review                     |
| Compromised camera/plugin              | IoT network isolation, minimum plugin permissions, no HOV credential  |
| Forged or replayed event               | Paired Deck signature, nonce/event ID, timestamp window, idempotency  |
| Live-link sharing                      | User-bound token, short expiry, no URL bearer, viewer audit           |
| Relay/session leak                     | Deck and HOV dual expiry, revoke, teardown monitoring, no recording   |
| Model drift                            | Versioned evaluation corpus and observe-mode reset                    |
| Monitoring people beyond the purpose   | Fixed zone, privacy masks, notice, bounded evidence, no identity      |
| HOV or internet outage                 | Local Deck event remains visible/retryable; no false delivery receipt |

## 8. Explicitly deferred

- Multiple cameras, camera groups, patrol tours, or remote PTZ from HOV.
- Continuous recording or cloud NVR.
- Audio, talkback, facial recognition, licence-plate recognition, identity watchlists, emotion, or
  employee scoring.
- SMS/WhatsApp/email escalation. First acceptance is a durable HOV alert; channel escalation is a
  later policy slice after delivery and consent are proven.
- Automatic task completion, police/security dispatch, sirens, access denial, or disciplinary action.
- Generic third-party plugin marketplace, hot-loaded native plugins, or arbitrary plugin cloud access.
- Event video clips; start with one snapshot.

## 9. Baton task packet for the next session

Do **not** create these as unrelated root tasks. In the next session, first re-open parent task
`2e4d5f5d-4a90-4099-9f97-d6059ac4b54c`, confirm current repo/worktree/Baton state, then create these
as child tasks or correctly related repo tasks. Preserve the dependency order.

| Order | Proposed task title                                                                 | Repo/owner               | Closeout evidence                                                      | Estimate |
| ----- | ----------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------- | -------- |
| 0     | Probe front-yard camera ONVIF/RTSP capabilities safely                              | Deck / human+agent       | Redacted capability report and selected adapter decision               | 2h       |
| 1     | Add Deck one-camera local adapter, credential reference, viewer, and privacy switch | Deck                     | Real ten-minute local view, restart, privacy stop, Rust/UI tests       | 1–2d     |
| 2     | Add NexaMesh person detector and front-yard observe-only zone rule                  | Deck + NexaMesh          | Labeled walk/no-person/animal/repeat corpus and one local event        | 1–2d     |
| 3     | Define and fixture-sign camera event/evidence/live-lease contracts                  | Deck + HOV               | Versioned cross-repo fixtures; no network calls                        | 0.5–1d   |
| 4     | Persist HOV camera events and private snapshot evidence idempotently                | HOV                      | Auth/API/storage/delete tests and cross-user denial                    | 1–2d     |
| 5     | Deliver a persistent HOV front-yard alert to configured responder Charl             | HOV                      | One replay -> one durable alert; realtime delivery and acknowledgement | 1d       |
| 6     | Add 120-second muted incident live lease and viewer                                 | Deck + HOV + relay       | Expiry, revoke, refresh denial, no relay recording/object              | 2–4d     |
| 7     | Run staffed front-yard gate-walk acceptance and failure matrix                      | Cross-repo / human+agent | Timestamp trace, screenshot, digest, notification, teardown evidence   | 0.5d     |
| 8     | Decide launch posture from authentic acceptance evidence                            | HOV / human              | Explicit enable/hold decision, residual risk, rollback/kill switch     | 0.5h     |

Recommended task relations:

- Task 0 blocks 1.
- Task 1 blocks 2 and authentic acceptance, but task 3 can start with the simulator.
- Task 3 blocks 4 and 6.
- Task 4 blocks 5.
- Tasks 2, 5, and 6 all block 7.
- Task 7 blocks 8.

Each task body must include the parent task ID, exact repo path/branch, relevant section of this PRD,
non-goals, files changed, commands run, tests/manual checks, and the next dependency. The task is not
done merely because its PR merges; retain authentic camera and staffed gate-walk acceptance as
separate gates.

## 10. First-session decisions

The next session should answer only the decisions necessary for Task 0 and Task 1:

1. What local protocol does the camera actually expose: ONVIF, RTSP, or vendor-only?
2. Which codec/profile gives stable low-latency local viewing on the Deck PC?
3. Which OS credential-store integration will Deck use?
4. Where does the callable NexaMesh vision runtime live, and can it process frames locally?
5. Is the front-yard camera placement and zone notice/privacy mask approved for this test?

Relay vendor/hosting and long-term retention do not need to block the first local Deck slices.
