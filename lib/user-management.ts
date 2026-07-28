import { isPostgresConfigured, query, withClient } from "@/lib/db/postgres"
import { User, UserRole, findUserByIdAsync, getAllUsersAsync } from "@/lib/users"
import { defaultUserThemeForColor, isUserThemeId } from "@/lib/user-themes"

export type UserStatus = "active" | "inactive" | "onboarding" | "offboarding" | "offboarded"

export type OnboardingStatus = "pending" | "in_progress" | "completed"

export type OffboardingStatus = "none" | "initiated" | "in_progress" | "completed"

export interface UserWithManagement extends User {
  status: UserStatus
  responsibilities: string[]
  onboardingStatus: OnboardingStatus
  onboardingCompletedAt: string | null
  offboardingStatus: OffboardingStatus
  offboardingInitiatedAt: string | null
}

const DEFAULT_STATUS: UserStatus = "active"
const DEFAULT_ONBOARDING: OnboardingStatus = "pending"
const DEFAULT_OFFBOARDING: OffboardingStatus = "none"

let schemaEnsured = false

async function ensureUserManagementSchema(): Promise<void> {
  if (!schemaEnsured && isPostgresConfigured()) {
    await withClient(async (client) => {
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='status') THEN
            ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
          END IF;
        END $$;
      `)
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_id TEXT;`)
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='responsibilities') THEN
            ALTER TABLE users ADD COLUMN responsibilities JSONB DEFAULT '[]';
          END IF;
        END $$;
      `)
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='onboarding_status') THEN
            ALTER TABLE users ADD COLUMN onboarding_status TEXT DEFAULT 'pending';
          END IF;
        END $$;
      `)
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='onboarding_completed_at') THEN
            ALTER TABLE users ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
          END IF;
        END $$;
      `)
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='offboarding_status') THEN
            ALTER TABLE users ADD COLUMN offboarding_status TEXT DEFAULT 'none';
          END IF;
        END $$;
      `)
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='offboarding_initiated_at') THEN
            ALTER TABLE users ADD COLUMN offboarding_initiated_at TIMESTAMPTZ;
          END IF;
        END $$;
      `)
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='photo_url') THEN
            ALTER TABLE users ADD COLUMN photo_url TEXT;
          END IF;
        END $$;
      `)
    })
    schemaEnsured = true
  }
}

function rowToUserWithManagement(row: Record<string, unknown>): UserWithManagement {
  const responsibilities = Array.isArray(row.responsibilities)
    ? row.responsibilities
    : typeof row.responsibilities === "string"
      ? (JSON.parse(row.responsibilities || "[]") as string[])
      : []
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    phone: row.phone as string,
    role: row.role as UserRole,
    description: (row.description as string) || "",
    color: (row.color as string) || "gray",
    themeId: isUserThemeId(row.theme_id)
      ? row.theme_id
      : defaultUserThemeForColor(row.color as string | undefined),
    icon: (row.icon as string) || "👤",
    specialty: Array.isArray(row.specialty) ? (row.specialty as string[]) : [],
    photoUrl: row.photo_url as string | undefined,
    status: (row.status as UserStatus) || DEFAULT_STATUS,
    responsibilities,
    onboardingStatus: (row.onboarding_status as OnboardingStatus) || DEFAULT_ONBOARDING,
    onboardingCompletedAt: row.onboarding_completed_at
      ? new Date(row.onboarding_completed_at as string).toISOString()
      : null,
    offboardingStatus: (row.offboarding_status as OffboardingStatus) || DEFAULT_OFFBOARDING,
    offboardingInitiatedAt: row.offboarding_initiated_at
      ? new Date(row.offboarding_initiated_at as string).toISOString()
      : null,
  }
}

export async function getAllUsersWithManagement(): Promise<UserWithManagement[]> {
  if (!isPostgresConfigured()) {
    const users = await getAllUsersAsync()
    return users.map((u) => ({
      ...u,
      status: "active" as UserStatus,
      responsibilities: u.specialty || [],
      onboardingStatus: u.id === "hans" ? "completed" : ("pending" as OnboardingStatus),
      onboardingCompletedAt: u.id === "hans" ? new Date().toISOString() : null,
      offboardingStatus: "none" as OffboardingStatus,
      offboardingInitiatedAt: null,
    })) as UserWithManagement[]
  }
  await ensureUserManagementSchema()
  const { rows } = await query<Record<string, unknown>>(
    `SELECT id, name, email, phone, role, description, color, theme_id, icon, specialty,
            COALESCE(status, 'active') as status,
            COALESCE(responsibilities::jsonb, '[]')::jsonb as responsibilities,
            COALESCE(onboarding_status, 'pending') as onboarding_status,
            onboarding_completed_at,
            COALESCE(offboarding_status, 'none') as offboarding_status,
            offboarding_initiated_at
     FROM users ORDER BY name`
  )
  return rows.map(rowToUserWithManagement)
}

export async function getUserWithManagement(id: string): Promise<UserWithManagement | null> {
  if (!isPostgresConfigured()) {
    const user = await findUserByIdAsync(id)
    if (!user) return null
    return {
      ...user,
      status: "active" as UserStatus,
      responsibilities: user.specialty || [],
      onboardingStatus: user.id === "hans" ? "completed" : ("pending" as OnboardingStatus),
      onboardingCompletedAt: user.id === "hans" ? new Date().toISOString() : null,
      offboardingStatus: "none" as OffboardingStatus,
      offboardingInitiatedAt: null,
    } as UserWithManagement
  }
  await ensureUserManagementSchema()
  const { rows } = await query<Record<string, unknown>>(
    `SELECT id, name, email, phone, role, description, color, theme_id, icon, specialty, photo_url,
            COALESCE(status, 'active') as status,
            COALESCE(responsibilities::jsonb, '[]')::jsonb as responsibilities,
            COALESCE(onboarding_status, 'pending') as onboarding_status,
            onboarding_completed_at,
            COALESCE(offboarding_status, 'none') as offboarding_status,
            offboarding_initiated_at
     FROM users WHERE LOWER(id) = LOWER($1) LIMIT 1`,
    [id]
  )
  return rows[0] ? rowToUserWithManagement(rows[0]) : null
}

export async function updateUserManagement(
  id: string,
  updates: Partial<{
    status: UserStatus
    email: string
    role: UserRole
    responsibilities: string[]
    onboardingStatus: OnboardingStatus
    onboardingCompletedAt: string | null
    offboardingStatus: OffboardingStatus
    offboardingInitiatedAt: string | null
  }>
): Promise<UserWithManagement | null> {
  if (!isPostgresConfigured()) return null
  await ensureUserManagementSchema()

  const setClauses: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (updates.status != null) {
    setClauses.push(`status = $${idx++}`)
    values.push(updates.status)
  }
  if (updates.email != null) {
    setClauses.push(`email = $${idx++}`)
    values.push(updates.email)
  }
  if (updates.role != null) {
    setClauses.push(`role = $${idx++}`)
    values.push(updates.role)
  }
  if (updates.responsibilities != null) {
    setClauses.push(`responsibilities = $${idx++}::jsonb`)
    values.push(JSON.stringify(updates.responsibilities))
  }
  if (updates.onboardingStatus != null) {
    setClauses.push(`onboarding_status = $${idx++}`)
    values.push(updates.onboardingStatus)
  }
  if (updates.onboardingCompletedAt !== undefined) {
    setClauses.push(`onboarding_completed_at = $${idx++}`)
    values.push(updates.onboardingCompletedAt)
  }
  if (updates.offboardingStatus != null) {
    setClauses.push(`offboarding_status = $${idx++}`)
    values.push(updates.offboardingStatus)
  }
  if (updates.offboardingInitiatedAt !== undefined) {
    setClauses.push(`offboarding_initiated_at = $${idx++}`)
    values.push(updates.offboardingInitiatedAt)
  }

  if (setClauses.length === 0) return getUserWithManagement(id)

  setClauses.push(`updated_at = NOW()`)
  values.push(id)

  await query(`UPDATE users SET ${setClauses.join(", ")} WHERE LOWER(id) = LOWER($${idx})`, values)
  return getUserWithManagement(id)
}

export async function completeOnboardingStep(id: string): Promise<UserWithManagement | null> {
  const user = await getUserWithManagement(id)
  if (!user) return null
  if (user.onboardingStatus === "completed") return user
  return updateUserManagement(id, {
    onboardingStatus: "completed",
    onboardingCompletedAt: new Date().toISOString(),
    status: "active",
  })
}

export async function initiateOffboarding(id: string): Promise<UserWithManagement | null> {
  return updateUserManagement(id, {
    offboardingStatus: "initiated",
    offboardingInitiatedAt: new Date().toISOString(),
    status: "offboarding",
  })
}

export async function completeOffboarding(id: string): Promise<UserWithManagement | null> {
  return updateUserManagement(id, {
    offboardingStatus: "completed",
    status: "offboarded",
  })
}
