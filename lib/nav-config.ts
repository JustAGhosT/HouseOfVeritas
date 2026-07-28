/**
 * Navigation config driven by role + responsibilities (ADR-006 Phase 2).
 */

import type { UserRole } from "@/lib/users"
import {
  Home,
  FileText,
  Users,
  Package,
  ClipboardList,
  Clock,
  Car,
  DollarSign,
  Settings,
  BarChart3,
  Calendar,
  Wrench,
  Boxes,
  ScanLine,
  Store,
  CheckSquare,
  FolderKanban,
  ChefHat,
  ShieldCheck,
  FlaskConical,
  type LucideIcon,
} from "lucide-react"
import {
  getDefaultResponsibilities,
  hasResponsibility,
  type Responsibility,
} from "@/lib/access-config"

export type NavItem = { name: string; href: string; icon: LucideIcon }
export type NavCategory = { category: string; items: NavItem[] }
export type NavEntry = NavItem | NavCategory

export function isCategory(e: NavEntry): e is NavCategory {
  return "category" in e && "items" in e
}

export function isNavHrefActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname === href) return true

  // Overview routes are persona roots, not catch-alls for every unmapped
  // dashboard page. Nested matching is still useful for real section roots.
  const isDashboardRoot = /^\/dashboard(?:\/[^/]+)?$/.test(href)
  return !isDashboardRoot && pathname.startsWith(`${href}/`)
}

export function getActiveNavName(entries: NavEntry[], pathname: string | null): string {
  if (!pathname) return "Workspace"

  const items = entries.flatMap((entry) => (isCategory(entry) ? entry.items : [entry]))
  const active = items
    .filter((item) => isNavHrefActive(item.href, pathname))
    .sort((left, right) => right.href.length - left.href.length)[0]

  return active?.name ?? "Workspace"
}

const PERSONA_TO_ROLE: Record<string, UserRole> = {
  hans: "admin",
  charl: "operator",
  lucky: "employee",
  irma: "resident",
}

interface PageDef {
  name: string
  href: string
  icon: LucideIcon
  category?: string
  requiredResponsibility?: Responsibility | null
  adminOnly?: boolean
}

const PAGE_DEFINITIONS: PageDef[] = [
  { name: "Overview", href: "/dashboard", icon: Home },
  { name: "Team", href: "/dashboard/hans/team", icon: Users, category: "People", adminOnly: true },
  {
    name: "Approvals",
    href: "/dashboard/hans/approvals",
    icon: CheckSquare,
    category: "People",
    adminOnly: true,
  },
  {
    name: "Work",
    href: "/dashboard",
    icon: FolderKanban,
    category: "Operations",
    requiredResponsibility: "Projects",
  },
  { name: "Tasks", href: "/dashboard", icon: ClipboardList, category: "Operations" },
  {
    name: "Time & Attendance",
    href: "/dashboard",
    icon: Clock,
    category: "Operations",
    requiredResponsibility: "Time",
  },
  {
    name: "Expenses",
    href: "/dashboard",
    icon: DollarSign,
    category: "Operations",
    requiredResponsibility: "Expenses",
  },
  {
    name: "Vehicles (Soon)",
    href: "/dashboard",
    icon: Car,
    category: "Operations",
    requiredResponsibility: "Vehicles",
  },
  {
    name: "Assets",
    href: "/dashboard",
    icon: Package,
    category: "Operations",
    requiredResponsibility: "Assets",
  },
  {
    name: "Inventory",
    href: "/dashboard",
    icon: Boxes,
    category: "Operations",
  },
  {
    name: "Maintenance",
    href: "/dashboard",
    icon: Wrench,
    category: "Operations",
    adminOnly: true,
  },
  {
    name: "Documents",
    href: "/dashboard",
    icon: FileText,
    category: "Documents & Finance",
    requiredResponsibility: "Documents",
  },
  {
    name: "Calendar",
    href: "/dashboard",
    icon: Calendar,
    category: "Documents & Finance",
    adminOnly: true,
  },
  {
    name: "Payroll",
    href: "/dashboard",
    icon: DollarSign,
    category: "Documents & Finance",
    adminOnly: true,
  },
  { name: "OCR Scanner", href: "/dashboard", icon: ScanLine, category: "Tools", adminOnly: true },
  { name: "Marketplace", href: "/dashboard", icon: Store, category: "Tools", adminOnly: true },
  { name: "Reports", href: "/dashboard", icon: BarChart3, category: "Admin", adminOnly: true },
  {
    name: "Governance",
    href: "/dashboard/hans/governance",
    icon: ShieldCheck,
    category: "Admin",
    adminOnly: true,
  },
  {
    name: "Reviewer Lab",
    href: "/dashboard/hans/reviewer-lab",
    icon: FlaskConical,
    category: "Admin",
    adminOnly: true,
  },
  { name: "Settings", href: "/dashboard", icon: Settings, category: "Admin" },
  { name: "Recipes", href: "/dashboard", icon: ChefHat, category: "Operations" },
]

const PERSONA_HREF_OVERRIDES: Record<string, Record<string, string>> = {
  hans: {
    Overview: "/dashboard/hans",
    Team: "/dashboard/hans/team",
    Approvals: "/dashboard/hans/approvals",
    Tasks: "/dashboard/hans/tasks",
    "Time & Attendance": "/dashboard/hans/time",
    Expenses: "/dashboard/hans/expenses",
    "Vehicles (Soon)": "/dashboard/hans/vehicles",
    Assets: "/dashboard/hans/assets",
    Inventory: "/dashboard/hans/inventory",
    Maintenance: "/dashboard/hans/maintenance",
    Documents: "/dashboard/hans/documents",
    Calendar: "/dashboard/hans/calendar",
    Payroll: "/dashboard/hans/payroll",
    "OCR Scanner": "/dashboard/hans/ocr",
    Marketplace: "/dashboard/hans/marketplace",
    Reports: "/dashboard/hans/reports",
    Governance: "/dashboard/hans/governance",
    "Reviewer Lab": "/dashboard/hans/reviewer-lab",
    Settings: "/dashboard/hans/settings",
    Recipes: "/dashboard/hans/recipes",
    Work: "/dashboard/hans/projects",
  },
  charl: {
    Overview: "/dashboard/charl",
    Work: "/dashboard/charl/projects",
    Tasks: "/dashboard/charl/tasks",
    "Time & Attendance": "/dashboard/charl/time",
    "Vehicles (Soon)": "/dashboard/charl/vehicles",
    Assets: "/dashboard/charl/assets",
    Inventory: "/dashboard/charl/inventory",
    Documents: "/dashboard/charl/documents",
    Recipes: "/dashboard/charl/recipes",
    Settings: "/dashboard/charl/settings",
  },
  lucky: {
    Overview: "/dashboard/lucky",
    Work: "/dashboard/lucky/projects",
    Tasks: "/dashboard/lucky/tasks",
    "Time & Attendance": "/dashboard/lucky/time",
    "Vehicles (Soon)": "/dashboard/lucky/vehicles",
    Inventory: "/dashboard/lucky/inventory",
    Expenses: "/dashboard/lucky/expenses",
    Documents: "/dashboard/lucky/documents",
    Recipes: "/dashboard/lucky/recipes",
    Settings: "/dashboard/lucky/settings",
  },
  irma: {
    Overview: "/dashboard/irma",
    Work: "/dashboard/irma/projects",
    Tasks: "/dashboard/irma/tasks",
    Inventory: "/dashboard/irma/inventory",
    Documents: "/dashboard/irma/documents",
    Recipes: "/dashboard/irma/recipes",
    Settings: "/dashboard/irma/settings",
  },
}

const PERSONA_LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  charl: {
    Overview: "My Dashboard",
    Tasks: "My Tasks",
    "Time & Attendance": "Time Clock",
    "Vehicles (Soon)": "Vehicles (Soon)",
    Documents: "My Documents",
  },
  lucky: {
    Overview: "My Dashboard",
    Tasks: "My Tasks",
    "Time & Attendance": "Time Clock",
    "Vehicles (Soon)": "Vehicles (Soon)",
    Documents: "My Documents",
  },
  irma: {
    Overview: "My Dashboard",
    Tasks: "Household Tasks",
    Documents: "My Documents",
  },
}

function canAccessPage(page: PageDef, role: UserRole, responsibilities: string[]): boolean {
  if (role === "admin") return true
  if (page.adminOnly) return false
  if (!page.requiredResponsibility) return true
  return hasResponsibility(responsibilities, page.requiredResponsibility)
}

export function buildNavEntries(
  persona: "hans" | "charl" | "lucky" | "irma",
  role: UserRole,
  responsibilities: string[]
): NavEntry[] {
  const overrides = PERSONA_HREF_OVERRIDES[persona] || {}
  const labels = PERSONA_LABEL_OVERRIDES[persona] || {}

  const isAdmin = role === "admin"
  const isResident = role === "resident"
  const isOperator = role === "operator"
  const isEmployee = role === "employee"

  const filtered = PAGE_DEFINITIONS.filter((p) => canAccessPage(p, role, responsibilities))

  const byCategory = new Map<string, NavItem[]>()
  const uncategorized: NavItem[] = []

  for (const p of filtered) {
    const href = overrides[p.name]
    // The shared page inventory includes responsibility-gated capabilities that
    // are not implemented for every persona. Do not surface a dead or fallback
    // link until that persona has an explicit route.
    if (!href) continue
    const name = labels[p.name] ?? p.name
    const item: NavItem = { name, href, icon: p.icon }

    if (persona !== "hans" && p.category === "People") continue
    if (persona !== "hans" && p.category === "Documents & Finance" && p.adminOnly) continue
    if (
      persona !== "hans" &&
      (p.category === "Tools" || (p.category === "Admin" && p.name === "Reports"))
    )
      continue

    if (persona === "hans") {
      if (p.category) {
        const list = byCategory.get(p.category) || []
        list.push(item)
        byCategory.set(p.category, list)
      } else {
        uncategorized.push(item)
      }
    } else {
      if (p.name === "Overview" || p.name === "Settings") {
        uncategorized.push(item)
      } else {
        const cat = isResident ? "Household" : "Work"
        const list = byCategory.get(cat) || []
        list.push(item)
        byCategory.set(cat, list)
      }
    }
  }

  const result: NavEntry[] = []

  if (persona === "hans") {
    if (uncategorized.length > 0) result.push(uncategorized[0])
    const categories: [string, NavItem[] | undefined][] = [
      ["People", byCategory.get("People")],
      ["Operations", byCategory.get("Operations")],
      ["Documents & Finance", byCategory.get("Documents & Finance")],
      ["Tools", byCategory.get("Tools")],
      ["Admin", byCategory.get("Admin")],
    ]
    for (const [cat, items] of categories) {
      if (items && items.length) result.push({ category: cat, items })
    }
  } else {
    const work = byCategory.get("Work") || byCategory.get("Household") || []
    result.push(uncategorized.find((u) => u.name === "My Dashboard") || uncategorized[0])
    if (work.length > 0) result.push({ category: "Work", items: work })
    if (isResident) (result[1] as NavCategory).category = "Household"
    result.push(
      uncategorized.find((u) => u.name === "Settings") || {
        name: "Settings",
        href: `/dashboard/${persona}/settings`,
        icon: Settings,
      }
    )
  }

  return result.filter(Boolean)
}

export function getNavForPersona(
  persona: "hans" | "charl" | "lucky" | "irma",
  role?: UserRole,
  responsibilities?: string[]
): NavEntry[] {
  const r = role ?? PERSONA_TO_ROLE[persona]
  const resp = responsibilities ?? getDefaultResponsibilities(r)
  return buildNavEntries(persona, r, resp)
}
