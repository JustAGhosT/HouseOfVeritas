import { describe, expect, it } from "vitest"
import { buildNavEntries, isCategory, type NavEntry } from "@/lib/nav-config"

function flatten(entries: NavEntry[]) {
  return entries.flatMap((entry) => (isCategory(entry) ? entry.items : [entry]))
}

describe("nav-config inventory access", () => {
  it("shows inventory for every persona", () => {
    const personas = [
      ["hans", "admin", "/dashboard/hans/inventory"],
      ["charl", "operator", "/dashboard/charl/inventory"],
      ["lucky", "employee", "/dashboard/lucky/inventory"],
      ["irma", "resident", "/dashboard/irma/inventory"],
    ] as const

    for (const [persona, role, href] of personas) {
      const items = flatten(buildNavEntries(persona, role, []))
      expect(items).toContainEqual(expect.objectContaining({ name: "Inventory", href }))
    }
  })

  it("shows governance only in the admin navigation", () => {
    const adminItems = flatten(buildNavEntries("hans", "admin", []))
    const operatorItems = flatten(buildNavEntries("charl", "operator", []))

    expect(adminItems).toContainEqual(
      expect.objectContaining({
        name: "Governance",
        href: "/dashboard/hans/governance",
      })
    )
    expect(operatorItems).not.toContainEqual(expect.objectContaining({ name: "Governance" }))
  })
})
