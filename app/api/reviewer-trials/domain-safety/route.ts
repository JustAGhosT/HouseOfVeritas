import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import {
  DOMAIN_SAFETY_CRITICAL_GATES,
  DOMAIN_SAFETY_FINDING_CATEGORIES,
  DOMAIN_SAFETY_PROFILE_VERSION,
  DOMAIN_SAFETY_QUALITY_DIMENSIONS,
  DOMAIN_SAFETY_SCENARIO_STEPS,
  DOMAIN_SAFETY_SYNTHETIC_CANDIDATE_ID,
  DOMAIN_SAFETY_TRIAL_PACK_VERSION,
  DOMAIN_SAFETY_TRIAL_SCHEMA_VERSION,
  DOMAIN_SAFETY_VARIANTS,
  domainSafetyTrialSubmissionSchema,
  evaluateDomainSafetyTrial,
  findProhibitedDomainTrialKey,
} from "@/lib/reviewer-trials/domain-safety-trial"

export const GET = withRole("admin")(async () => {
  return NextResponse.json({
    data: {
      schemaVersion: DOMAIN_SAFETY_TRIAL_SCHEMA_VERSION,
      packVersion: DOMAIN_SAFETY_TRIAL_PACK_VERSION,
      profileVersion: DOMAIN_SAFETY_PROFILE_VERSION,
      candidateId: DOMAIN_SAFETY_SYNTHETIC_CANDIDATE_ID,
      variants: DOMAIN_SAFETY_VARIANTS,
      scenarioSteps: DOMAIN_SAFETY_SCENARIO_STEPS,
      criticalGates: DOMAIN_SAFETY_CRITICAL_GATES,
      qualityDimensions: DOMAIN_SAFETY_QUALITY_DIMENSIONS,
      findingCategories: DOMAIN_SAFETY_FINDING_CATEGORIES,
      provider: {
        id: "pirb",
        name: "Plumbing Industry Registration Board",
        integrationStatus: "manual_preview_only",
        verificationPerformed: false,
        officialUrl: "https://www.pirb.co.za/",
      },
    },
    summary: {
      mode: "synthetic_rehearsal",
      persisted: false,
      externalEffects: false,
      pirbEligibility: "not_evaluated",
      o5Activation: false,
    },
  })
})

export const POST = withRole("admin")(async (request) => {
  try {
    const body: unknown = await request.json()
    const prohibitedKey = findProhibitedDomainTrialKey(body)
    if (prohibitedKey) {
      return NextResponse.json(
        { error: "Restricted reviewer data is prohibited", prohibitedKey },
        { status: 400 }
      )
    }

    const parsed = domainSafetyTrialSubmissionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid synthetic reviewer rehearsal",
          issues: parsed.error.issues.map((issue) => issue.path.join(".")),
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data: { evaluation: evaluateDomainSafetyTrial(parsed.data) },
      summary: {
        accepted: true,
        persisted: false,
        externalEffects: false,
        pirbEligibility: "not_evaluated",
        o5Activation: false,
      },
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    logger.error("Synthetic domain reviewer rehearsal failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to evaluate synthetic rehearsal" }, { status: 500 })
  }
})
