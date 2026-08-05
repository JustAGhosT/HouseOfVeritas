import { readFileSync } from "node:fs"
import { resolve } from "node:path"
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

  it("omits responsibility links when the persona route is not implemented", () => {
    const charlItems = flatten(buildNavEntries("charl", "operator", [...RESPONSIBILITIES]))
    const luckyItems = flatten(buildNavEntries("lucky", "employee", [...RESPONSIBILITIES]))
    const irmaItems = flatten(buildNavEntries("irma", "resident", [...RESPONSIBILITIES]))

    expect(charlItems).not.toContainEqual(expect.objectContaining({ name: "Expenses" }))
    expect(luckyItems).not.toContainEqual(expect.objectContaining({ name: "Assets" }))
    expect(irmaItems).not.toContainEqual(expect.objectContaining({ name: "Time & Attendance" }))
    expect(irmaItems).not.toContainEqual(expect.objectContaining({ name: "Expenses" }))
    expect(irmaItems).not.toContainEqual(expect.objectContaining({ name: "Vehicles (Soon)" }))
    expect(irmaItems).not.toContainEqual(expect.objectContaining({ name: "Assets" }))
  })
})

describe("nav-config casting access", () => {
  it("shows the casting planner to admin and operators, but not to residents", () => {
    const withAccess = [
      ["hans", "admin", "/dashboard/hans/casting"],
      ["charl", "operator", "/dashboard/charl/casting"],
      ["lucky", "employee", "/dashboard/lucky/casting"],
    ] as const

    for (const [persona, role, href] of withAccess) {
      const items = flatten(buildNavEntries(persona, role, RESPONSIBILITIES.slice()))
      expect(items).toContainEqual(expect.objectContaining({ name: "Casting", href }))
    }

    // Casting is operator work and the API refuses residents outright.
    const irma = flatten(buildNavEntries("irma", "resident", RESPONSIBILITIES.slice()))
    expect(irma.map((item) => item.name)).not.toContain("Casting")
  })
})

describe("nav-config admin coverage contract", () => {
  it("gives the admin persona a route for every page in the shared inventory", () => {
    // A page with no href override is silently dropped from the nav, so a new
    // page that forgets hans disappears for the one role meant to see it all.
    const source = readFileSync(resolve(process.cwd(), "lib/nav-config.ts"), "utf8")

    const pageNames = [...source.matchAll(/\{\s*name:\s*"([^"]+)",\s*\n?\s*href:/g)].map(
      (match) => match[1]
    )
    const hansBlock = source.slice(source.indexOf("hans: {"), source.indexOf("charl: {"))
    const hansRoutes = [...hansBlock.matchAll(/^\s*"?([A-Za-z &()]+?)"?:\s*"\//gm)].map((match) =>
      match[1].trim()
    )

    expect(pageNames.length).toBeGreaterThan(15)
    expect(pageNames.filter((name) => !hansRoutes.includes(name))).toEqual([])
  })
})
