import { describe, expect, it } from "vitest"
import { buildNavEntries, isCategory, type NavEntry } from "@/lib/nav-config"
import { RESPONSIBILITIES } from "@/lib/access-config"

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

  it("shows governance and the reviewer lab only in the admin navigation", () => {
    const adminItems = flatten(buildNavEntries("hans", "admin", []))
    const operatorItems = flatten(buildNavEntries("charl", "operator", []))

    expect(adminItems).toContainEqual(
      expect.objectContaining({
        name: "Governance",
        href: "/dashboard/hans/governance",
      })
    )
    expect(operatorItems).not.toContainEqual(expect.objectContaining({ name: "Governance" }))
    expect(adminItems).toContainEqual(
      expect.objectContaining({
        name: "Reviewer Lab",
        href: "/dashboard/hans/reviewer-lab",
      })
    )
    expect(operatorItems).not.toContainEqual(expect.objectContaining({ name: "Reviewer Lab" }))
  })

  it("keeps renamed persona navigation labels on their distinct routes", () => {
    const personas = [
      ["charl", "operator", "My Tasks", "/dashboard/charl/tasks"],
      ["lucky", "employee", "My Tasks", "/dashboard/lucky/tasks"],
      ["irma", "resident", "Household Tasks", "/dashboard/irma/tasks"],
    ] as const

    for (const [persona, role, taskLabel, taskHref] of personas) {
      const items = flatten(buildNavEntries(persona, role, []))

      expect(items).toContainEqual(expect.objectContaining({ name: taskLabel, href: taskHref }))
      expect(items).toContainEqual(
        expect.objectContaining({ name: "My Dashboard", href: `/dashboard/${persona}` })
      )
      expect(items.filter((item) => item.href === `/dashboard/${persona}`)).toHaveLength(1)
    }
  })

  it("gives every reachable persona entry a unique persona-scoped route", () => {
    const personas = [
      ["hans", "admin"],
      ["charl", "operator"],
      ["lucky", "employee"],
      ["irma", "resident"],
    ] as const

    for (const [persona, role] of personas) {
      const items = flatten(buildNavEntries(persona, role, [...RESPONSIBILITIES]))
      const hrefs = items.map((item) => item.href)

      expect(hrefs.every((href) => href.startsWith(`/dashboard/${persona}`))).toBe(true)
      expect(new Set(hrefs).size).toBe(hrefs.length)
    }
  })
})
