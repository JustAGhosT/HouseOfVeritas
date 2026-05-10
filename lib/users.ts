import { hashSync, compareSync } from "bcryptjs"
import { isPostgresConfigured, query, withClient, ensureSchema } from "@/lib/db/postgres"

export interface User {
  id: string
  name: string
  email: string
  phone: string
  passwordHash: string
  role: UserRole
  description: string
  color: string
  icon: string
  specialty: string[]
  photoUrl?: string
}

export type UserRole = "admin" | "resident" | "operator" | "employee"

const BCRYPT_ROUNDS = 10

// Demo accounts (predictable passwords). Only present outside production
// unless ALLOW_DEMO_USERS=true is set explicitly.
const DEMO_USERS_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_USERS === "true"

const DEMO_SEED_USERS: Record<string, User> = DEMO_USERS_ENABLED
  ? {
      "demo-user-1": {
        id: "demo-user-1",
        name: "Demo Admin",
        email: "demo-user-1@example.com",
        phone: "+27000000001",
        passwordHash: hashSync("password123", BCRYPT_ROUNDS),
        role: "admin",
        description: "Demo Administrator account",
        color: "blue",
        icon: "🛡️",
        specialty: ["Administration", "Compliance"],
      },
      "demo-user-2": {
        id: "demo-user-2",
        name: "Demo Operator",
        email: "demo-user-2@example.com",
        phone: "+27000000002",
        passwordHash: hashSync("password123", BCRYPT_ROUNDS),
        role: "operator",
        description: "Demo Operator account",
        color: "amber",
        icon: "🔧",
        specialty: ["Operations", "Maintenance"],
      },
      "demo-user-3": {
        id: "demo-user-3",
        name: "Demo Resident",
        email: "demo-user-3@example.com",
        phone: "+27000000003",
        passwordHash: hashSync("password123", BCRYPT_ROUNDS),
        role: "resident",
        description: "Demo Resident account",
        color: "purple",
        icon: "🏠",
        specialty: ["Household", "Management"],
      },
      "demo-user-4": {
        id: "demo-user-4",
        name: "Demo Employee",
        email: "demo-user-4@example.com",
        phone: "+27000000004",
        passwordHash: hashSync("password123", BCRYPT_ROUNDS),
        role: "employee",
        description: "Demo Employee account",
        color: "green",
        icon: "👤",
        specialty: ["Tasks", "Support"],
      },
    }
  : {}

export const USERS: Record<string, User> = {
  hans: {
    id: "hans",
    name: "Hans",
    email: "hans@houseofv.com",
    phone: "+27692381255",
    passwordHash: hashSync("hans123", BCRYPT_ROUNDS),
    role: "admin",
    description: "Full platform access, approvals, and oversight",
    color: "blue",
    icon: "👔",
    specialty: ["Tech", "Leadership", "Electronics"],
  },
  irma: {
    id: "irma",
    name: "Irma",
    email: "irma@houseofv.com",
    phone: "+27711488390",
    passwordHash: hashSync("irma123", BCRYPT_ROUNDS),
    role: "resident",
    description: "Household tasks, documents, limited access",
    color: "purple",
    icon: "🏠",
    specialty: ["Babysitting", "Cleaning", "Food"],
  },
  charl: {
    id: "charl",
    name: "Charl",
    email: "charl@houseofv.com",
    phone: "+27711488390",
    passwordHash: hashSync("charl123", BCRYPT_ROUNDS),
    role: "operator",
    description: "Tasks, assets, time tracking, vehicle logs",
    color: "amber",
    icon: "🔧",
    specialty: ["Tinkerer", "Electrician", "Plumber", "Magicman"],
  },
  lucky: {
    id: "lucky",
    name: "Lucky",
    email: "lucky@houseofv.com",
    phone: "+27794142410",
    passwordHash: hashSync("lucky123", BCRYPT_ROUNDS),
    role: "employee",
    description: "Tasks, expenses, vehicle logs, time tracking",
    color: "green",
    icon: "🌿",
    specialty: ["Gardening", "Painting", "Manual Labour"],
  },
  ...DEMO_SEED_USERS,
}

let usersSchemaEnsured = false

async function ensureUsersSchemaOnce(): Promise<void> {
  if (!usersSchemaEnsured && isPostgresConfigured()) {
    await ensureSchema()
    usersSchemaEnsured = true
  }
}

function rowToUser(row: {
  id: string
  name: string
  email: string
  phone: string
  password_hash: string
  role: string
  description: string
  color: string
  icon: string
  specialty: string[]
  photo_url?: string
}): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    role: row.role as UserRole,
    description: row.description || "",
    color: row.color || "gray",
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
  const { rows } = await query<{
    id: string
    name: string
    email: string
    phone: string
    password_hash: string
    role: string
    description: string
    color: string
    icon: string
    specialty: string[]
  }>(
    `SELECT id, name, email, phone, password_hash, role, description, color, icon, specialty
     FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  )
  return rows[0] ? rowToUser(rows[0]) : undefined
}

export async function getAllUsersAsync(): Promise<User[]> {
  if (!isPostgresConfigured()) {
    return Object.values(USERS)
  }
  await ensureUsersSchemaOnce()
  await seedUsersIfEmpty()
  const { rows } = await query<{
    id: string
    name: string
    email: string
    phone: string
    password_hash: string
    role: string
    description: string
    color: string
    icon: string
    specialty: string[]
  }>(
    `SELECT id, name, email, phone, password_hash, role, description, color, icon, specialty FROM users`
  )
  return rows.map(rowToUser)
}

export async function findUserByIdAsync(id: string): Promise<User | undefined> {
  if (!isPostgresConfigured()) {
    return findUserById(id)
  }
  await ensureUsersSchemaOnce()
  await seedUsersIfEmpty()
  const { rows } = await query<{
    id: string
    name: string
    email: string
    phone: string
    password_hash: string
    role: string
    description: string
    color: string
    icon: string
    specialty: string[]
    photo_url?: string
  }>(
    `SELECT id, name, email, phone, password_hash, role, description, color, icon, specialty, photo_url
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
        `INSERT INTO users (id, name, email, phone, password_hash, role, description, color, icon, specialty)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          user.id,
          user.name,
          user.email,
          user.phone,
          user.passwordHash,
          user.role,
          user.description,
          user.color,
          user.icon,
          user.specialty,
        ]
      )
    }
  })
}

export function findUserByEmail(email: string): User | undefined {
  return Object.values(USERS).find((user) => user.email.toLowerCase() === email.toLowerCase())
}

export function findUserById(id: string): User | undefined {
  return USERS[id.toLowerCase()]
}

export function findUserByPhone(phone: string): User | undefined {
  const normalizedPhone = phone.replace(/\s/g, "")
  return Object.values(USERS).find((user) => user.phone === normalizedPhone)
}

export function verifyPassword(plaintext: string, hash: string): boolean {
  return compareSync(plaintext, hash)
}

export function generateRandomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let password = ""
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

const passwordOverrides: Record<string, string> = {}

export async function getPasswordHashAsync(userId: string): Promise<string> {
  if (isPostgresConfigured()) {
    const user = await findUserByIdAsync(userId)
    return user?.passwordHash ?? ""
  }
  return passwordOverrides[userId] || USERS[userId]?.passwordHash || ""
}

export function getPasswordHash(userId: string): string {
  return passwordOverrides[userId] || USERS[userId]?.passwordHash || ""
}

export function setPassword(userId: string, newPassword: string): void {
  passwordOverrides[userId] = hashSync(newPassword, BCRYPT_ROUNDS)
}

export async function updateUserProfileAsync(
  id: string,
  updates: { name?: string; phone?: string; photoUrl?: string }
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
  return user
}

export async function setPasswordAsync(userId: string, newPassword: string): Promise<boolean> {
  const hash = hashSync(newPassword, BCRYPT_ROUNDS)
  if (isPostgresConfigured()) {
    await ensureUsersSchemaOnce()
    const { rowCount } = await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE LOWER(id) = LOWER($2)`,
      [hash, userId]
    )
    return rowCount > 0
  }
  setPassword(userId, newPassword)
  return true
}

export function safeUser(user: User): Omit<User, "passwordHash"> {
  const { passwordHash: _, ...safe } = user
  return safe
}
