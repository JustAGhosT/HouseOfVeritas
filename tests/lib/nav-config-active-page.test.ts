import { Home, Settings } from "lucide-react"
import { describe, expect, it } from "vitest"
import { getActiveNavName, type NavEntry } from "@/lib/nav-config"

const navEntries: NavEntry[] = [
  { name: "Overview", href: "/dashboard/hans", icon: Home },
  { name: "Settings", href: "/dashboard/hans/settings", icon: Settings },
]

describe("getActiveNavName", () => {
  it("matches exact dashboard roots without treating them as catch-alls", () => {
    expect(getActiveNavName(navEntries, "/dashboard/hans")).toBe("Overview")
    expect(getActiveNavName(navEntries, "/dashboard/hans/maintenance")).toBe("Workspace")
  })

  it("keeps nested section routes associated with their navigation entry", () => {
    expect(getActiveNavName(navEntries, "/dashboard/hans/settings/profile")).toBe("Settings")
  })
})
