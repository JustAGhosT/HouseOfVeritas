import { isPostgresConfigured, query, withClient, ensureSchema } from "@/lib/db/postgres"
import { defaultUserThemeForColor, isUserThemeId, type UserThemeId } from "@/lib/user-themes"

export interface User {
  id: string
  name: string
  /** Contact address used by notifications and profile management. */
  email: string
  /** Verified email claim accepted from the OIDC provider; defaults to `email`. */
  oidcEmail?: string
  phone: string
  role: UserRole
  description: string
  color: string
  themeId?: UserThemeId
  icon: string
  specialty: string[]
  photoUrl?: string
}

export type UserRole = "admin" | "resident" | "operator" | "employee"

const DEMO_USERS_ENABLED = process.env.ALLOW_DEMO_USERS === "true"

const DEMO_SEED_USERS: Record<string, User> = DEMO_USERS_ENABLED
  ? {
      "demo-user-1": {
        id: "demo-user-1",
        name: "Demo Admin",
        email: "demo-user-1@example.com",
        phone: "+27000000001",
        role: "admin",
        description: "Demo Administrator account",
        color: "blue",
        themeId: "ocean",
        icon: "🛡️",
        specialty: ["Administration", "Compliance"],
      },
      "demo-user-2": {
        id: "demo-user-2",
        name: "Demo Operator",
        email: "demo-user-2@example.com",
        phone: "+27000000002",
        role: "operator",
        description: "Demo Operator account",
        color: "amber",
        themeId: "ember",
        icon: "🔧",
        specialty: ["Operations", "Maintenance"],
      },
      "demo-user-3": {
        id: "demo-user-3",
        name: "Demo Resident",
        email: "demo-user-3@example.com",
        phone: "+27000000003",
        role: "resident",
        description: "Demo Resident account",
        color: "purple",
        themeId: "amethyst",
        icon: "🏠",
        specialty: ["Household", "Management"],
      },
      "demo-user-4": {
        id: "demo-user-4",
        name: "Demo Employee",
        email: "demo-user-4@example.com",
        phone: "+27000000004",
        role: "employee",
        description: "Demo Employee account",
        color: "green",
        themeId: "garden",
        icon: "👤",
        specialty: ["Tasks", "Support"],
      },
    }
  : {}

export const USERS: Record<string, User> = {
  hans: {
    id: "hans",
    name: "Hans",
    email: "smit.jurie@gmail.com",
    phone: "+27692381255",
    role: "admin",
    description: "Full platform access, approvals, and oversight",
    color: "blue",
    themeId: "ocean",
    icon: "👔",
    specialty: ["Tech", "Leadership", "Electronics"],
  },
  irma: {
    id: "irma",
    name: "Irma",
    email: "irma@houseofv.com",
    phone: "+27711488390",
    role: "resident",
    description: "Household tasks, documents, limited access",
    color: "purple",
    themeId: "amethyst",
    icon: "🏠",
    specialty: ["Babysitting", "Cleaning", "Food"],
  },
  charl: {
    id: "charl",
    name: "Charl",
    email: "chapmancharl28@gmail.com",
    phone: "+27711488390",
    role: "operator",
    description: "Tasks, assets, time tracking, vehicles coming soon",
    color: "amber",
    themeId: "ember",
    icon: "🔧",
    specialty: ["Tinkerer", "Electrician", "Plumber", "Magicman"],
  },
  lucky: {
    id: "lucky",
    name: "Lucky",
    email: "lucky@houseofv.com",
    oidcEmail: "omniposthq@gmail.com",
    phone: "+27794142410",
    role: "employee",
    description: "Tasks, expenses, time tracking, vehicles coming soon",
    color: "green",
    themeId: "garden",
    icon: "🌿",
    specialty: ["Gardening", "Painting", "Manual Labour"],
  },
  ...DEMO_SEED_USERS,
}

let usersSchemaEnsured = false

async function ensureUsersSchemaOnce(): Promise<void> {
  if (!usersSchemaEnsured && isPostgresConfigured()) {
    await ensureSchema()
    for (const user of Object.values(USERS)) {
      if (!user.oidcEmail) continue
      const conflict = await query<{ id: string }>(
        `SELECT id FROM users
         WHERE LOWER(id) <> LOWER($2)
           AND (LOWER(email) = LOWER($1) OR LOWER(oidc_email) = LOWER($1))
         LIMIT 1`,
        [user.oidcEmail, user.id]
      )
      if (conflict.rowCount > 0) {
        throw new Error("OIDC identity mapping conflicts with an existing user")
      }
      await query(
        `UPDATE users
         SET oidc_email = $1, updated_at = NOW()
         WHERE LOWER(id) = LOWER($2)
           AND (oidc_email IS NULL OR LOWER(oidc_email) = LOWER(email))`,
        [user.oidcEmail, user.id]
      )
    }
    await query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_effective_oidc_email
       ON users(LOWER(COALESCE(oidc_email, email)))`
    )
    usersSchemaEnsured = true
  }
}

type UserRow = {
  id: string
  name: string
  email: string
  oidc_email?: string | null
  phone: string
  role: string
  description: string
  color: string
  theme_id?: string | null
  icon: string
  specialty: string[]
  photo_url?: string
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    oidcEmail: row.oidc_email || undefined,
    phone: row.phone,
    role: row.role as UserRole,
    description: row.description || "",
    color: row.color || "gray",
    themeId: isUserThemeId(row.theme_id) ? row.theme_id : defaultUserThemeForColor(row.color),
    icon: row.icon || "👤",
    specialty: Array.isArray(row.specialty) ? row.specialty : [],
    photoUrl: row.photo_url,
  }
}

export async function findUserByEmailAsync(email: string): Promise<User | undefined> {
  if (!isPostgresConfigured()) {
    return findUserByEmail(email)
  }
  await ensureUsersSchemaOnce()
  await seedUsersIfEmpty()
  const { rows } = await query<UserRow>(
    `SELECT id, name, email, oidc_email, phone, role, description, color, theme_id, icon, specialty
     FROM users WHERE LOWER(COALESCE(oidc_email, email)) = LOWER($1) LIMIT 1`,
    [email]
  )
  return rows[0] ? rowToUser(rows[0]) : undefined
}

/**
 * Find a user by email, or create a minimal record for a newly-seen,
 * IdP-verified user. Used by the OIDC signIn callback (gated on
 * OIDC_AUTO_PROVISION) so users can sign in without being pre-provisioned;
 * they complete their profile (name/phone) during onboarding. New users get
 * the least-privileged "resident" role.
 *
 * In static (no-Postgres) mode the new user is held in-memory only and does
 * not survive a restart — acceptable for demo onboarding, not durable accounts.
 */
export async function findOrCreateOidcUserAsync(
  email: string,
  name?: string | null
): Promise<User> {
  const normalizedEmail = email.toLowerCase()
  const existing = await findUserByEmailAsync(normalizedEmail)
  if (existing) return existing

  // Email is the identity key (unique in the schema / deduped above). The id is
  // a random UUID — never derived from the email — so distinct emails can never
  // collide onto the same id (which would let one user be admitted as another).
  const user: User = {
    id: `oidc-${globalThis.crypto.randomUUID()}`,
    name: name?.trim() || normalizedEmail.split("@")[0],
    email: normalizedEmail,
    oidcEmail: normalizedEmail,
    phone: "",
    role: "resident",
    description: "Self-provisioned via Mystira sign-in",
    color: "gray",
    themeId: "sanctum",
    icon: "👤",
    specialty: [],
  }

  if (isPostgresConfigured()) {
    await ensureUsersSchemaOnce()
    await query(
      `INSERT INTO users (id, name, email, oidc_email, phone, role, description, color, theme_id, icon, specialty)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (email) DO NOTHING`,
      [
        user.id,
        user.name,
        user.email,
        user.oidcEmail,
        user.phone,
        user.role,
        user.description,
        user.color,
        user.themeId,
        user.icon,
        user.specialty,
      ]
    )
    // Return only a canonical persisted row. A contact-address or effective-
    // identity collision can make the insert a no-op; never admit the random
    // in-memory user in that case because later requests could not resolve it.
    const persisted = await findUserByEmailAsync(normalizedEmail)
    if (!persisted) {
      throw new Error("OIDC user could not be persisted without an identity conflict")
    }
    return persisted
  }

  USERS[user.id] = user
  return user
}

export async function getAllUsersAsync(): Promise<User[]> {
  if (!isPostgresConfigured()) {
    return Object.values(USERS)
  }
  await ensureUsersSchemaOnce()
  await seedUsersIfEmpty()
  const { rows } = await query<UserRow>(
    `SELECT id, name, email, oidc_email, phone, role, description, color, theme_id, icon, specialty FROM users`
  )
  return rows.map(rowToUser)
}

export async function findUserByIdAsync(id: string): Promise<User | undefined> {
  if (!isPostgresConfigured()) {
    return findUserById(id)
  }
  await ensureUsersSchemaOnce()
  await seedUsersIfEmpty()
  const { rows } = await query<UserRow>(
    `SELECT id, name, email, oidc_email, phone, role, description, color, theme_id, icon, specialty, photo_url
     FROM users WHERE LOWER(id) = LOWER($1) LIMIT 1`,
    [id]
  )
  return rows[0] ? rowToUser(rows[0]) : undefined
}

export async function seedUsersIfEmpty(): Promise<void> {
  if (!isPostgresConfigured()) return
  await ensureUsersSchemaOnce()
  const { rowCount } = await query("SELECT 1 FROM users LIMIT 1")
  if (rowCount > 0) return

  await withClient(async (client) => {
    for (const user of Object.values(USERS)) {
      await client.query(
        `INSERT INTO users (id, name, email, oidc_email, phone, role, description, color, theme_id, icon, specialty)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          user.id,
          user.name,
          user.email,
          user.oidcEmail ?? null,
          user.phone,
          user.role,
          user.description,
          user.color,
          user.themeId,
          user.icon,
          user.specialty,
        ]
      )
    }
  })
}

export function findUserByEmail(email: string): User | undefined {
  return Object.values(USERS).find(
    (user) => (user.oidcEmail ?? user.email).toLowerCase() === email.toLowerCase()
  )
}

export function findUserById(id: string): User | undefined {
  return USERS[id.toLowerCase()]
}

export function findUserByPhone(phone: string): User | undefined {
  const normalizedPhone = phone.replace(/\s/g, "")
  return Object.values(USERS).find((user) => user.phone === normalizedPhone)
}

export async function updateUserProfileAsync(
  id: string,
  updates: { name?: string; phone?: string; photoUrl?: string; themeId?: UserThemeId }
): Promise<User | null> {
  if (isPostgresConfigured()) {
    await ensureUsersSchemaOnce()
    const setClauses: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (updates.name != null) {
      setClauses.push(`name = $${idx++}`)
      values.push(updates.name)
    }
    if (updates.phone != null) {
      setClauses.push(`phone = $${idx++}`)
      values.push(updates.phone)
    }
    if (updates.photoUrl !== undefined) {
      setClauses.push(`photo_url = $${idx++}`)
      values.push(updates.photoUrl)
    }
    if (updates.themeId !== undefined) {
      setClauses.push(`theme_id = $${idx++}`)
      values.push(updates.themeId)
    }
    if (setClauses.length === 0) return (await findUserByIdAsync(id)) ?? null
    setClauses.push(`updated_at = NOW()`)
    values.push(id)
    await query(
      `UPDATE users SET ${setClauses.join(", ")} WHERE LOWER(id) = LOWER($${idx})`,
      values
    )
    return (await findUserByIdAsync(id)) ?? null
  }
  const user = USERS[id.toLowerCase()]
  if (!user) return null
  if (updates.name != null) user.name = updates.name
  if (updates.phone != null) user.phone = updates.phone
  if (updates.photoUrl !== undefined) (user as User).photoUrl = updates.photoUrl
  if (updates.themeId !== undefined) user.themeId = updates.themeId
  return user
}

export function safeUser(user: User): User {
  return user
}
