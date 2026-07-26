import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import GovernancePage from "@/app/dashboard/hans/governance/page"
import { GATE_ZERO_DECISIONS } from "@/lib/governance/gate-definitions"

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

function governanceResponse() {
  return {
    data: {
      gate: {
        id: "under-sink-leak-gate-0",
        name: "Under-sink leak Gate 0",
        protocolVersion: "v1-draft",
      },
      decisions: GATE_ZERO_DECISIONS.map((definition) => ({
        definition,
        current: null,
        history: [],
        missingPrerequisites: [],
      })),
      storage: "memory",
    },
    summary: { total: 7, active: 0, approvedInPrinciple: 0 },
  }
}

describe("Gate governance page", () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    apiFetchMock.mockResolvedValue(governanceResponse())
  })

  it("renders all Gate decisions and the restricted-data warning", async () => {
    render(<GovernancePage />)

    expect(await screen.findByRole("heading", { name: "Gate Governance" })).toBeInTheDocument()
    expect(screen.getByText(/Store only pseudonymous IDs/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText("Pending")).toHaveLength(7))
    expect(screen.getByTestId("gate-decision-O5")).toHaveTextContent("Qualified plumbing reviewer")
  })

  it("opens the immutable decision form with the safe initial transition", async () => {
    const user = userEvent.setup()
    render(<GovernancePage />)

    await user.click(await screen.findByTestId("record-decision-O5"))

    expect(screen.getByRole("dialog")).toHaveTextContent("O5: Qualified plumbing reviewer")
    expect(screen.getByTestId("gate-status-select")).toHaveTextContent("Approved in principle")
    expect(screen.queryByTestId("reviewer-candidate-id")).not.toBeInTheDocument()
    expect(screen.getByTestId("submit-gate-decision")).toBeDisabled()
  })
})
