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
  { name: "Settings", href: "/dashboard", icon: Settings, category: "Admin" },
]

const PERSONA_HREF_OVERRIDES: Record<string, Record<string, string>> = {
  hans: {
    Overview: "/dashboard/hans",
    Team: "/dashboard/hans/team",
    Tasks: "/dashboard/hans/tasks",
    "Time & Attendance": "/dashboard/hans/time",
    Expenses: "/dashboard/hans/expenses",
    "Vehicles (Soon)": "/dashboard/hans/vehicles",
    Assets: "/dashboard/hans/assets",
    Inventory: "/dashboard/hans/inventory",
    Documents: "/dashboard/hans/documents",
    Calendar: "/dashboard/hans/calendar",
    Payroll: "/dashboard/hans/payroll",
    "OCR Scanner": "/dashboard/hans/ocr",
    Marketplace: "/dashboard/hans/marketplace",
    Reports: "/dashboard/hans/reports",
    Settings: "/dashboard/hans/settings",
    Work: "/dashboard/hans/projects",
  },
  charl: {
    "My Dashboard": "/dashboard/charl",
    Work: "/dashboard/charl/projects",
    "My Tasks": "/dashboard/charl/tasks",
    "Time Clock": "/dashboard/charl/time",
    "Vehicles (Soon)": "/dashboard/charl/vehicles",
    Assets: "/dashboard/charl/assets",
    Inventory: "/dashboard/charl/inventory",
    "My Documents": "/dashboard/charl/documents",
    Settings: "/dashboard/charl/settings",
  },
  lucky: {
    "My Dashboard": "/dashboard/lucky",
    Work: "/dashboard/lucky/projects",
    "My Tasks": "/dashboard/lucky/tasks",
    "Time Clock": "/dashboard/lucky/time",
    "Vehicles (Soon)": "/dashboard/lucky/vehicles",
    Inventory: "/dashboard/lucky/inventory",
    Expenses: "/dashboard/lucky/expenses",
    "My Documents": "/dashboard/lucky/documents",
    Settings: "/dashboard/lucky/settings",
  },
  irma: {
    "My Dashboard": "/dashboard/irma",
    Work: "/dashboard/irma/projects",
    "Household Tasks": "/dashboard/irma/tasks",
    Inventory: "/dashboard/irma/inventory",
    "My Documents": "/dashboard/irma/documents",
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
    const href = overrides[p.name] ?? p.href.replace("/dashboard", `/dashboard/${persona}`)
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
