import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ReviewerLabPage from "@/app/dashboard/hans/reviewer-lab/page"
import {
  DOMAIN_SAFETY_CRITICAL_GATES,
  DOMAIN_SAFETY_FINDING_CATEGORIES,
  DOMAIN_SAFETY_QUALITY_DIMENSIONS,
  DOMAIN_SAFETY_SCENARIO_STEPS,
  DOMAIN_SAFETY_VARIANTS,
} from "@/lib/reviewer-trials/domain-safety-trial"

const apiFetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api-client", () => ({
  apiFetch: apiFetchMock,
  ApiError: class ApiError extends Error {
    body?: unknown
  },
}))

vi.mock("@/components/dashboard-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const definition = {
  data: {
    schemaVersion: "domain-reviewer-lab-v1",
    packVersion: "DSR-SYNTH-001-v1",
    profileVersion: "za-domestic-drainage-v1",
    candidateId: "DSR-SIM-001",
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
}

const evaluation = {
  data: {
    evaluation: {
      candidateId: "DSR-SIM-001",
      packVersion: "DSR-SYNTH-001-v1",
      variant: "B",
      disposition: "close_without_reliance",
      criticalFailures: [],
      incompleteCriticalGates: ["credential_process"],
      qualityFailures: [],
      incompleteQualityDimensions: [],
      findingCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      reliance: "none",
      pirbEligibility: "not_evaluated",
      o5Activation: false,
      persisted: false,
      externalEffects: false,
    },
  },
  summary: { accepted: true, persisted: false, externalEffects: false },
}

describe("Domain Reviewer Lab page", () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    apiFetchMock.mockImplementation((_url: string, options?: { method?: string }) =>
      Promise.resolve(options?.method === "POST" ? evaluation : definition)
    )
  })

  it("renders the synthetic-only PIRB boundary without free-text evidence fields", async () => {
    render(<ReviewerLabPage />)

    expect(await screen.findByRole("heading", { name: "Domain Reviewer Lab" })).toBeInTheDocument()
    expect(screen.getByText("Internal synthetic testing only")).toBeInTheDocument()
    expect(await screen.findByText("Manual preview only")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Official PIRB site/ })).toHaveAttribute(
      "href",
      "https://www.pirb.co.za/"
    )
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.getByTestId("evaluate-domain-rehearsal")).toBeDisabled()
  })

  it("submits only fixed synthetic categories after all acknowledgements", async () => {
    const user = userEvent.setup()
    render(<ReviewerLabPage />)

    await user.click(await screen.findByTestId("reviewer-variant-B"))
    await user.click(screen.getByTestId("lab-acknowledgement-1"))
    await user.click(screen.getByTestId("lab-acknowledgement-2"))
    await user.click(screen.getByTestId("lab-acknowledgement-3"))
    await user.click(screen.getByTestId("evaluate-domain-rehearsal"))

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2))
    const postOptions = apiFetchMock.mock.calls[1][1]
    expect(postOptions).toMatchObject({
      method: "POST",
      body: {
        candidateId: "DSR-SIM-001",
        variant: "B",
        dataClass: "synthetic",
        pirbVerification: { status: "not_performed" },
        externalEffects: { registryCall: false, contacted: false, productionAccess: false },
      },
    })
    expect(await screen.findByTestId("domain-rehearsal-result")).toHaveTextContent(
      "close without reliance"
    )
  })

  it("resets all run-specific state before reloading the rehearsal", async () => {
    const user = userEvent.setup()
    render(<ReviewerLabPage />)

    await user.click(await screen.findByTestId("reviewer-variant-B"))
    await user.click(screen.getByTestId("lab-acknowledgement-1"))
    await user.click(screen.getByTestId("lab-acknowledgement-2"))
    await user.click(screen.getByTestId("lab-acknowledgement-3"))
    await user.click(screen.getByTestId("evaluate-domain-rehearsal"))
    expect(await screen.findByTestId("domain-rehearsal-result")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Reset rehearsal" }))

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(3))
    expect(screen.queryByTestId("domain-rehearsal-result")).not.toBeInTheDocument()
    expect(screen.getByTestId("reviewer-variant-A")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId("evaluate-domain-rehearsal")).toBeDisabled()
    expect(screen.getByTestId("lab-acknowledgement-1")).not.toBeChecked()
    expect(screen.getByTestId("lab-acknowledgement-2")).not.toBeChecked()
    expect(screen.getByTestId("lab-acknowledgement-3")).not.toBeChecked()
  })
})
