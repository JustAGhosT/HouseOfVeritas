#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const REQUIRED_EVENTS = [
  "nomination_proposed",
  "activation_preflight",
  "invitation_previewed",
  "consent_simulated",
  "session_started",
  "finding_recorded",
  "session_closed",
  "retention_scheduled",
]

const PROHIBITED_KEYS = new Set([
  "address",
  "candidateName",
  "contactDetails",
  "credentialNumber",
  "email",
  "phone",
  "rawNotes",
  "recording",
  "realHouseholdId",
])

const ALLOWED_VARIANTS = new Set(["A", "B", "C", "D"])
const ALLOWED_DISPOSITIONS = new Set([
  "revise_before_more_alpha",
  "run_next_variant",
  "close_without_reliance",
])

const TOP_LEVEL_KEYS = [
  "candidateId",
  "dataClass",
  "events",
  "evidenceClaims",
  "externalEffects",
  "mode",
  "packVersion",
  "schemaVersion",
  "simulatedEscalationRoutes",
  "variant",
]

const EVENT_KEYS = {
  nomination_proposed: ["conflictDisposition", "source", "type"],
  activation_preflight: ["result", "type"],
  invitation_previewed: ["delivery", "type", "variant"],
  consent_simulated: ["notes", "result", "type"],
  session_started: ["baselineShown", "firstExposure", "type", "variant"],
  finding_recorded: ["behaviorCategory", "reproducibility", "severity", "type"],
  session_closed: ["disposition", "reliance", "type"],
  retention_scheduled: ["restrictedRecord", "reviewDue", "type"],
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertExactKeys(value, expectedKeys, path) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${path} must be an object`)
  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${path} contains missing or unknown fields`
  )
}

function assertNoProhibitedKeys(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoProhibitedKeys(item, `${path}[${index}]`))
    return
  }

  if (value === null || typeof value !== "object") {
    return
  }

  for (const [key, nested] of Object.entries(value)) {
    assert(!PROHIBITED_KEYS.has(key), `prohibited key ${path}.${key}`)
    assertNoProhibitedKeys(nested, `${path}.${key}`)
  }
}

function eventIndex(events, type) {
  return events.findIndex((event) => event.type === type)
}

export function validateAlphaReviewE2e(run) {
  assert(run && typeof run === "object" && !Array.isArray(run), "run must be an object")
  assertNoProhibitedKeys(run)
  assertExactKeys(run, TOP_LEVEL_KEYS, "run")

  assert(run.schemaVersion === "alpha-review-e2e-v1", "unsupported schemaVersion")
  assert(run.mode === "synthetic_harness", "mode must be synthetic_harness")
  assert(
    /^AER-SIM-[A-Z0-9-]+$/.test(run.candidateId),
    "candidateId must be synthetic and pseudonymous"
  )
  assert(run.packVersion === "AER-SYNTH-001-v1", "unexpected trial pack version")
  assert(ALLOWED_VARIANTS.has(run.variant), "variant must be A, B, C, or D")
  assert(run.dataClass === "synthetic", "dataClass must be synthetic")

  const effects = run.externalEffects
  const effectKeys = ["contacted", "invited", "recorded", "paid", "posted", "productionAccess"]
  assertExactKeys(effects, effectKeys, "externalEffects")
  for (const key of effectKeys) {
    assert(effects[key] === false, `external effect ${key} must be false`)
  }

  const routes = run.simulatedEscalationRoutes
  assertExactKeys(routes, ["domainSafety", "privacy"], "simulatedEscalationRoutes")
  for (const key of ["domainSafety", "privacy"]) {
    assertExactKeys(routes[key], ["preflight", "routeClass"], `simulatedEscalationRoutes.${key}`)
    assert(
      routes[key]?.routeClass === "simulated_not_live",
      `${key} route must be simulated_not_live`
    )
    assert(routes[key]?.preflight === "passed", `${key} simulated preflight must pass`)
  }

  assert(Array.isArray(run.events), "events must be an array")
  assert(
    run.events.length === REQUIRED_EVENTS.length,
    "events must contain the exact required sequence"
  )
  assert(
    new Set(run.events.map((event) => event.type)).size === run.events.length,
    "event types must not repeat"
  )

  REQUIRED_EVENTS.forEach((type, expectedIndex) => {
    assert(
      eventIndex(run.events, type) === expectedIndex,
      `event ${type} is missing or out of order`
    )
    assertExactKeys(run.events[expectedIndex], EVENT_KEYS[type], `events[${expectedIndex}]`)
  })

  const invitation = run.events[eventIndex(run.events, "invitation_previewed")]
  const session = run.events[eventIndex(run.events, "session_started")]
  assert(invitation.variant === run.variant, "variant must be present in the invitation preview")
  assert(invitation.delivery === "preview_only", "invitation must remain preview_only")
  assert(session.variant === run.variant, "session first exposure must use the assigned variant")
  assert(session.firstExposure === true, "session must record variant-first exposure")
  assert(session.baselineShown === false, "baseline must not prime the simulated run")

  const finding = run.events[eventIndex(run.events, "finding_recorded")]
  assert(
    ["critical", "high", "medium", "low"].includes(finding.severity),
    "finding severity is invalid"
  )
  assert(
    ["single", "variant_specific", "repeated"].includes(finding.reproducibility),
    "finding reproducibility is invalid"
  )
  assert(
    /^[a-z][a-z0-9_]{2,64}$/.test(finding.behaviorCategory),
    "finding must use a minimized category slug"
  )

  const closed = run.events[eventIndex(run.events, "session_closed")]
  assert(ALLOWED_DISPOSITIONS.has(closed.disposition), "session disposition is invalid")
  assert(closed.reliance === "none", "synthetic harness output must have no reliance")

  const retention = run.events[eventIndex(run.events, "retention_scheduled")]
  assert(/^\d{4}-\d{2}-\d{2}$/.test(retention.reviewDue), "retention reviewDue must be YYYY-MM-DD")
  assert(
    retention.restrictedRecord === "simulated_not_created",
    "no restricted record may be created"
  )

  const claims = run.evidenceClaims
  const claimKeys = ["participant", "usability", "customer", "market", "safety", "gateAdvancement"]
  assertExactKeys(claims, claimKeys, "evidenceClaims")
  for (const key of claimKeys) {
    assert(claims[key] === false, `evidence claim ${key} must be false`)
  }

  return {
    candidateId: run.candidateId,
    disposition: closed.disposition,
    eventCount: run.events.length,
    mode: run.mode,
    packVersion: run.packVersion,
    status: "passed",
    variant: run.variant,
  }
}

async function main() {
  const fixturePath = process.argv[2]
  assert(fixturePath, "usage: node scripts/verify-alpha-review-e2e.mjs <run.json>")

  const absolutePath = resolve(process.cwd(), fixturePath)
  const run = JSON.parse(await readFile(absolutePath, "utf8"))
  const result = validateAlphaReviewE2e(run)
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`alpha-review-e2e failed: ${error.message}\n`)
    process.exitCode = 1
  })
}
