import { isPostgresConfigured, query, withClient } from "@/lib/db/postgres"
import { UserRole } from "@/lib/users"

export interface DashboardPage {
  id: string
  name: string
  href: string
  icon: string
  description: string
  sortOrder: number
}

export interface RolePageAssignment {
  role: UserRole
  pageId: string
  requiredResponsibility: string | null
  sortOrder: number
}

const ICON_MAP: Record<string, string> = {
  Home: "Home",
  FileText: "FileText",
  Users: "Users",
  Package: "Package",
  ClipboardList: "ClipboardList",
  Clock: "Clock",
  Car: "Car",
  DollarSign: "DollarSign",
  Settings: "Settings",
  BarChart3: "BarChart3",
  Calendar: "Calendar",
  Wrench: "Wrench",
  Boxes: "Boxes",
  ScanLine: "ScanLine",
  Store: "Store",
  CheckSquare: "CheckSquare",
}

export const ALL_PAGES: DashboardPage[] = [
  {
    id: "overview",
    name: "Overview",
    href: "/dashboard",
    icon: "Home",
    description: "Dashboard home",
    sortOrder: 0,
  },
  {
    id: "approvals",
    name: "Approvals",
    href: "/dashboard/hans/approvals",
    icon: "CheckSquare",
    description: "Review requests",
    sortOrder: 1,
  },
  {
    id: "calendar",
    name: "Calendar",
    href: "/dashboard/hans/calendar",
    icon: "Calendar",
    description: "Calendar",
    sortOrder: 2,
  },
  {
    id: "documents",
    name: "Documents",
    href: "/dashboard/documents",
    icon: "FileText",
    description: "Documents",
    sortOrder: 3,
  },
  {
    id: "employees",
    name: "HR Roster",
    href: "/dashboard/hans/team",
    icon: "Users",
    description: "Baserow employees (in Team tab)",
    sortOrder: 4,
  },
  {
    id: "users",
    name: "Team",
    href: "/dashboard/hans/team",
    icon: "Users",
    description: "Platform users and HR roster",
    sortOrder: 5,
  },
  {
    id: "tasks",
    name: "Tasks",
    href: "/dashboard/tasks",
    icon: "ClipboardList",
    description: "Task management",
    sortOrder: 6,
  },
  {
    id: "payroll",
    name: "Payroll",
    href: "/dashboard/hans/payroll",
    icon: "DollarSign",
    description: "Payroll",
    sortOrder: 7,
  },
  {
    id: "assets",
    name: "Assets",
    href: "/dashboard/assets",
    icon: "Package",
    description: "Assets",
    sortOrder: 8,
  },
  {
    id: "inventory",
    name: "Inventory",
    href: "/dashboard/inventory",
    icon: "Boxes",
    description: "Inventory",
    sortOrder: 9,
  },
  {
    id: "ocr",
    name: "OCR Scanner",
    href: "/dashboard/hans/ocr",
    icon: "ScanLine",
    description: "OCR",
    sortOrder: 10,
  },
  {
    id: "marketplace",
    name: "Marketplace",
    href: "/dashboard/hans/marketplace",
    icon: "Store",
    description: "Marketplace",
    sortOrder: 11,
  },
  {
    id: "maintenance",
    name: "Maintenance",
    href: "/dashboard/hans/maintenance",
    icon: "Wrench",
    description: "Maintenance",
    sortOrder: 12,
  },
  {
    id: "time",
    name: "Time & Attendance",
    href: "/dashboard/time",
    icon: "Clock",
    description: "Time clock",
    sortOrder: 13,
  },
  {
    id: "expenses",
    name: "Expenses",
    href: "/dashboard/expenses",
    icon: "DollarSign",
    description: "Expenses",
    sortOrder: 14,
  },
  {
    id: "vehicles",
    name: "Vehicles (Soon)",
    href: "/dashboard/vehicles",
    icon: "Car",
    description: "Vehicle module coming soon",
    sortOrder: 15,
  },
  {
    id: "reports",
    name: "Reports",
    href: "/dashboard/hans/reports",
    icon: "BarChart3",
    description: "Reports",
    sortOrder: 16,
  },
  {
    id: "settings",
    name: "Settings",
    href: "/dashboard/hans/settings",
    icon: "Settings",
    description: "Settings",
    sortOrder: 17,
  },
]

const DEFAULT_ROLE_PAGES: Record<UserRole, string[]> = {
  admin: [
    "overview",
    "approvals",
    "calendar",
    "documents",
    "employees",
    "users",
    "tasks",
    "payroll",
    "assets",
    "inventory",
    "ocr",
    "marketplace",
    "maintenance",
    "time",
    "expenses",
    "vehicles",
    "reports",
    "settings",
  ],
  operator: ["overview", "tasks", "time", "assets", "vehicles", "documents"],
  employee: ["overview", "tasks", "time", "inventory", "expenses", "vehicles", "documents"],
  resident: ["overview", "tasks", "documents"],
}

function getDefaultPagesForRole(role: UserRole): string[] {
  return DEFAULT_ROLE_PAGES[role] || DEFAULT_ROLE_PAGES.employee
}

let schemaEnsured = false

async function ensureDashboardConfigSchema(): Promise<void> {
  if (!schemaEnsured && isPostgresConfigured()) {
    await withClient(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS dashboard_pages (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          href TEXT NOT NULL,
          icon TEXT NOT NULL,
          description TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0
        );
      `)
      await client.query(`
        CREATE TABLE IF NOT EXISTS role_dashboard_pages (
          id SERIAL PRIMARY KEY,
          role TEXT NOT NULL,
          page_id TEXT NOT NULL,
          required_responsibility TEXT,
          sort_order INTEGER DEFAULT 0
        );
      `)
      for (const page of ALL_PAGES) {
        await client.query(
          `INSERT INTO dashboard_pages (id, name, href, icon, description, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, href = EXCLUDED.href, icon = EXCLUDED.icon, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order`,
          [page.id, page.name, page.href, page.icon, page.description, page.sortOrder]
        )
      }
    })
    schemaEnsured = true
  }
}

export async function getNavItemsForUser(
  userId: string,
  role: UserRole,
  responsibilities: string[],
  personaId: string
): Promise<{ name: string; href: string; icon: string }[]> {
  const pageIds = await getPageIdsForRole(role)
  const pages = pageIds
    .map((id) => ALL_PAGES.find((p) => p.id === id))
    .filter((p): p is DashboardPage => !!p)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return pages.map((p) => {
    let href = p.href
    if (href.startsWith("/dashboard/") && !href.includes(personaId)) {
      const parts = href.split("/")
      if (parts[2] === "hans" || parts[2] === "dashboard") {
        parts[2] = personaId
        href = parts.join("/")
      }
    }
    if (href === "/dashboard" || href === "/dashboard/") {
      href = `/dashboard/${personaId}`
    }
    if (href === "/dashboard/documents") href = `/dashboard/${personaId}/documents`
    if (href === "/dashboard/tasks") href = `/dashboard/${personaId}/tasks`
    if (href === "/dashboard/time") href = `/dashboard/${personaId}/time`
    if (href === "/dashboard/expenses") href = `/dashboard/${personaId}/expenses`
    if (href === "/dashboard/vehicles") href = `/dashboard/${personaId}/vehicles`
    if (href === "/dashboard/assets") href = `/dashboard/${personaId}/assets`
    if (href === "/dashboard/inventory") href = `/dashboard/${personaId}/inventory`
    return { name: p.name, href, icon: p.icon }
  })
}

async function getPageIdsForRole(role: UserRole): Promise<string[]> {
  if (!isPostgresConfigured()) {
    return getDefaultPagesForRole(role)
  }
  await ensureDashboardConfigSchema()
  const { rows } = await query<{ page_id: string; sort_order: number }>(
    `SELECT page_id, sort_order FROM role_dashboard_pages WHERE role = $1 ORDER BY sort_order, page_id`,
    [role]
  )
  if (rows.length > 0) {
    return rows.map((r) => r.page_id)
  }
  return getDefaultPagesForRole(role)
}

export async function getRolePageAssignments(role: UserRole): Promise<RolePageAssignment[]> {
  if (!isPostgresConfigured()) {
    return getDefaultPagesForRole(role).map((pageId, i) => ({
      role,
      pageId,
      requiredResponsibility: null,
      sortOrder: i,
    }))
  }
  await ensureDashboardConfigSchema()
  const { rows } = await query<{
    page_id: string
    required_responsibility: string | null
    sort_order: number
  }>(
    `SELECT page_id, required_responsibility, sort_order FROM role_dashboard_pages WHERE role = $1 ORDER BY sort_order, page_id`,
    [role]
  )
  return rows.map((r) => ({
    role,
    pageId: r.page_id,
    requiredResponsibility: r.required_responsibility,
    sortOrder: r.sort_order,
  }))
}

export async function setRolePageAssignments(
  role: UserRole,
  pageIds: string[],
  assignments?: { pageId: string; requiredResponsibility?: string }[]
): Promise<void> {
  if (!isPostgresConfigured()) return
  await ensureDashboardConfigSchema()
  const assignMap = new Map((assignments || []).map((a) => [a.pageId, a.requiredResponsibility]))

  await withClient(async (client) => {
    await client.query(`DELETE FROM role_dashboard_pages WHERE role = $1`, [role])
    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i]
      const reqResp = assignMap.get(pageId)
      await client.query(
        `INSERT INTO role_dashboard_pages (role, page_id, required_responsibility, sort_order) VALUES ($1, $2, $3, $4)`,
        [role, pageId, reqResp || null, i]
      )
    }
  })
}

export function getIconComponent(iconName: string): string {
  return ICON_MAP[iconName] || "Home"
}
