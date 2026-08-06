import { expect, test, type BrowserContext } from "@playwright/test"
import { seedSession } from "./helpers/auth"
import {
  productionSessionCookies,
  type ProbeRole,
  type SessionCookie,
} from "./helpers/production-session"

const baseUrl = process.env.BASE_URL
const adminSessionCookies = productionSessionCookies("admin")
const isPostDeployProbe = process.env.POST_DEPLOY_PROBE === "true"

// Production issues no identity with role=operator, so the denial boundary is
// proved against whichever non-admin roles are actually available. Both are
// equally unauthorized for admin routes, so each independently proves the same
// withRole("admin") boundary. Locally both are seeded; against a deployment only
// the roles whose sessions were supplied run, and the rest skip rather than
// silently pass.
const denialRoles = [
  { role: "employee", seedId: "lucky" },
  { role: "operator", seedId: "charl" },
] as const satisfies ReadonlyArray<{ role: ProbeRole; seedId: string }>

test.describe.configure({ timeout: 60_000 })

const criticalGateIds = [
  "credential_process",
  "jurisdiction_experience",
  "independence",
  "critical_defect_recall",
  "unsafe_assertion",
  "data_boundary",
] as const

const qualityDimensionIds = [
  "evidence_classification",
  "ambiguity_handling",
  "stop_rule_quality",
  "plain_language",
  "traceable_rationale",
  "verification_design",
  "version_incident_governance",
] as const

async function addSessionCookies(context: BrowserContext, sessionCookies: SessionCookie[]) {
  const hostname = new URL(baseUrl!).hostname
  await context.addCookies(
    sessionCookies.map(({ name, value }) => ({
      name,
      value,
      domain: hostname,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }))
  )
}

async function prepareRoleSession(
  context: BrowserContext,
  role: ProbeRole,
  sessionCookies: SessionCookie[],
  seedId = role === "admin" ? "hans" : "charl"
) {
  if (isPostDeployProbe) {
    await addSessionCookies(context, sessionCookies)
    return
  }

  await seedSession(context, {
    id: seedId,
    role,
    email: `${role}@example.invalid`,
  })
}

test.describe("Post-deployment Gate 0 admin acceptance", () => {
  test.skip(
    isPostDeployProbe && (!baseUrl || adminSessionCookies.length === 0),
    "Requires POST_DEPLOY_PROBE, BASE_URL, and a legitimate short-lived admin session."
  )

  test.beforeEach(async ({ context }) => {
    await prepareRoleSession(context, "admin", adminSessionCookies)
  })

  test("completes a fictional reviewer rehearsal without persistence or external effects", async ({
    page,
  }) => {
    const response = await page.goto("/dashboard/hans/reviewer-lab")

    expect(response?.status()).toBe(200)
    await expect(page.getByTestId("domain-reviewer-lab-page")).toBeVisible()

    const variant = page.getByTestId("reviewer-variant-B")
    await variant.click()
    await expect(variant).toHaveAttribute("aria-pressed", "true")

    for (const gateId of criticalGateIds) {
      await page.getByTestId(`critical-gate-${gateId}`).selectOption("pass")
    }
    for (const dimensionId of qualityDimensionIds) {
      await page.getByTestId(`quality-dimension-${dimensionId}`).selectOption("clear")
    }
    for (let index = 1; index <= 3; index += 1) {
      await page.getByTestId(`lab-acknowledgement-${index}`).check()
    }

    await page.getByTestId("evaluate-domain-rehearsal").click()

    const result = page.getByTestId("domain-rehearsal-result")
    await expect(result).toBeVisible()
    await expect(result).toContainText("ready for internal replay")
    await expect(result).toContainText("Variant B; reliance none; PIRB eligibility not evaluated")
    await expect(result).toContainText("Not persisted")
    await expect(result).toContainText("No external effects")
    await expect(result).toContainText("O5 inactive")
    await expect(result).toContainText("0 critical gates incomplete")

    await page.reload()

    await expect(page.getByTestId("domain-reviewer-lab-page")).toBeVisible()
    await expect(page.getByTestId("domain-rehearsal-result")).toHaveCount(0)
    await expect(page.getByTestId("reviewer-variant-B")).toHaveAttribute("aria-pressed", "false")
  })

  test("can read the governance projection without mutating it", async ({ page }) => {
    const apiResponse = await page.request.get("/api/governance/gates")

    expect(apiResponse.status()).toBe(200)
    const body = await apiResponse.json()
    expect(Array.isArray(body.data?.decisions)).toBe(true)

    const pageResponse = await page.goto("/dashboard/hans/governance")
    expect(pageResponse?.status()).toBe(200)
    await expect(page.getByTestId("gate-governance-page")).toBeVisible()
    await expect(page.getByTestId("gate-decision-O5")).toBeVisible()
    await expect(page.getByTestId("gate-decision-O6")).toBeVisible()
  })
})

for (const { role, seedId } of denialRoles) {
  test.describe(`Post-deployment Gate 0 ${role} denial`, () => {
    const sessionCookies = productionSessionCookies(role)

    test.skip(
      isPostDeployProbe && (!baseUrl || sessionCookies.length === 0),
      `Requires POST_DEPLOY_PROBE, BASE_URL, and a legitimate short-lived ${role} session.`
    )

    test.beforeEach(async ({ context }) => {
      await prepareRoleSession(context, role, sessionCookies, seedId)
    })

    for (const path of ["/api/reviewer-trials/domain-safety", "/api/governance/gates"] as const) {
      test(`denies ${role} API access to ${path}`, async ({ page }) => {
        const response = await page.request.get(path)

        expect(response.status()).toBe(403)
        await expect(response.json()).resolves.toMatchObject({ error: "Insufficient permissions" })
      })
    }

    for (const path of ["/dashboard/hans/reviewer-lab", "/dashboard/hans/governance"] as const) {
      test(`redirects ${role === "employee" ? "an" : "a"} ${role} away from ${path}`, async ({
        page,
      }) => {
        await page.goto(path)

        await expect(page).not.toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}(?:\\?.*)?$`))
        await expect(page.getByTestId("domain-reviewer-lab-page")).toHaveCount(0)
        await expect(page.getByTestId("gate-governance-page")).toHaveCount(0)
      })
    }
  })
}
