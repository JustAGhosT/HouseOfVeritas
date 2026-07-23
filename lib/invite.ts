import { logger } from "@/lib/logger"
import { sendNotification } from "@/lib/services/notification-service"
import { findUserByIdAsync } from "@/lib/users"
import { SignJWT, jwtVerify } from "jose"

const INVITE_EXPIRY_HOURS = 72
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

function getSecret() {
  const secret = process.env.INVITE_JWT_SECRET || process.env.JWT_SECRET

  if (!secret || !secret.trim()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invite JWT secret is not configured. Set INVITE_JWT_SECRET or JWT_SECRET.")
    }
    // Development/test fallback
    return new TextEncoder().encode("hov-dev-secret")
  }

  return new TextEncoder().encode(secret)
}

export async function createInviteToken(userId: string): Promise<string> {
  const user = await findUserByIdAsync(userId)
  if (!user) throw new Error("User not found")

  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${INVITE_EXPIRY_HOURS}h`)
    .sign(getSecret())
}

// Persistent token revocation store interface
interface TokenRevocationStore {
  has(token: string): boolean
  add(token: string, expiry: number): Promise<void>
  cleanup(): Promise<void>
  stop(): void
}

// File-based implementation for small scale (4 users)
class FileTokenRevocationStore implements TokenRevocationStore {
  private filePath: string
  private tokens: Map<string, number>
  private cleanupInterval: NodeJS.Timeout | null = null
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

  constructor() {
    this.filePath = process.env.TOKEN_REVOCATION_FILE || "./data/revoked-tokens.json"
    this.tokens = new Map()
    this.loadFromFile()
    this.startCleanup()
  }

  private loadFromFile(): void {
    try {
      if (typeof window !== "undefined") return // Skip in browser
      const fs = require("fs")
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, "utf8")
        const parsed = JSON.parse(data)

        // Validate that parsed is a non-null plain object
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          logger.warn("Invalid token data format in file", {
            filePath: this.filePath,
            type: typeof parsed,
            isArray: Array.isArray(parsed),
            isNull: parsed === null,
          })
          return
        }

        // Validate each entry
        const validTokens = new Map<string, number>()
        Object.entries(parsed).forEach(([token, expiry]) => {
          // Ensure expiry is a valid number
          const expiryNum = typeof expiry === "number" ? expiry : Number(expiry)
          if (isNaN(expiryNum)) {
            logger.warn("Invalid expiry timestamp in revoked tokens file", {
              token: token.substring(0, 20),
              expiry,
            })
            return
          }
          validTokens.set(token, expiryNum)
        })

        this.tokens = validTokens
        logger.debug("Loaded revoked tokens from file", { count: this.tokens.size })
      }
    } catch (error) {
      logger.warn("Failed to load revoked tokens from file", { error })
    }
  }

  private async saveToFile(): Promise<void> {
    try {
      if (typeof window !== "undefined") return // Skip in browser
      const fs = require("fs").promises
      const dir = require("path").dirname(this.filePath)
      await fs.mkdir(dir, { recursive: true })
      const obj = Object.fromEntries(this.tokens)
      await fs.writeFile(this.filePath, JSON.stringify(obj, null, 2))
    } catch (error) {
      logger.warn("Failed to save revoked tokens to file", { error })
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch((err) => {
        logger.warn("Token cleanup failed", { error: err })
      })
    }, this.CLEANUP_INTERVAL_MS)
  }

  has(token: string): boolean {
    const expiry = this.tokens.get(token)
    if (expiry) {
      if (expiry > Date.now()) {
        return true
      }
      // Token expired, remove it and schedule async save
      this.tokens.delete(token)
      setImmediate(() => {
        this.saveToFile().catch((err) => {
          logger.warn("Failed to save after token expiration", { error: err })
        })
      })
      return false
    }
    return false
  }

  async add(token: string, expiry: number): Promise<void> {
    this.tokens.set(token, expiry)
    await this.saveToFile()
    logger.info("Invite token revoked and persisted", {
      tokenPrefix: token.slice(0, 8) + "...",
      expiry: new Date(expiry).toISOString(),
    })
  }

  async cleanup(): Promise<void> {
    const now = Date.now()
    let cleaned = 0
    for (const [token, expiry] of this.tokens.entries()) {
      if (expiry <= now) {
        this.tokens.delete(token)
        cleaned++
      }
    }
    if (cleaned > 0) {
      await this.saveToFile()
      logger.debug("Cleaned up expired revoked tokens", { count: cleaned })
    }
  }

  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    await this.saveToFile()
  }
}

// In-memory fallback for development/testing
class InMemoryTokenRevocationStore implements TokenRevocationStore {
  private tokens: Map<string, number>
  private cleanupInterval: NodeJS.Timeout | null = null
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

  constructor() {
    this.tokens = new Map()
    this.startCleanup()
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(() => {})
    }, this.CLEANUP_INTERVAL_MS)
  }

  has(token: string): boolean {
    const expiry = this.tokens.get(token)
    if (expiry) {
      if (expiry > Date.now()) {
        return true
      }
      this.tokens.delete(token)
      return false
    }
    return false
  }

  async add(token: string, expiry: number): Promise<void> {
    this.tokens.set(token, expiry)
    logger.info("Invite token invalidated", { tokenPrefix: token.slice(0, 8) + "..." })
  }

  async cleanup(): Promise<void> {
    const now = Date.now()
    let cleaned = 0
    for (const [token, expiry] of this.tokens.entries()) {
      if (expiry <= now) {
        this.tokens.delete(token)
        cleaned++
      }
    }
    if (cleaned > 0) {
      logger.debug("Cleaned up expired invalidated tokens", { count: cleaned })
    }
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

// Factory function to create appropriate store
function createTokenRevocationStore(): TokenRevocationStore {
  // Use file-based store in production, in-memory for development
  if (process.env.NODE_ENV === "production" || process.env.USE_PERSISTENT_TOKENS === "true") {
    return new FileTokenRevocationStore()
  }
  return new InMemoryTokenRevocationStore()
}

// Export store instance
const tokenRevocationStore = createTokenRevocationStore()

// Export cleanup function for graceful shutdown
export function stopInviteTokenCleanup(): void {
  tokenRevocationStore.stop()
}

export async function validateInviteToken(token: string): Promise<{ userId: string } | null> {
  try {
    // Check if token has been revoked using persistent store
    if (tokenRevocationStore.has(token)) {
      return null
    }
    const { payload } = await jwtVerify(token, getSecret())
    const userId = payload.userId as string
    return userId ? { userId } : null
  } catch {
    return null
  }
}

export async function invalidateInviteToken(token: string): Promise<void> {
  // Validate token format
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    logger.warn("Invalid token provided to invalidateInviteToken", {
      token: token?.substring(0, 10),
    })
    return
  }

  // Validate token structure (basic JWT format check)
  if (!token.includes(".") || token.split(".").length !== 3) {
    logger.warn("Invalid token format", { token: token.substring(0, 20) })
    return
  }

  // Verify token signature/claims
  try {
    const secret = getSecret()
    await jwtVerify(token, secret)
    // Token is valid - proceed with revocation
  } catch (error) {
    logger.warn("Token verification failed", { error, token: token.substring(0, 20) })
    return
  }

  // Store token with expiry (72 hours from now, matching token expiry) using persistent store
  const expiryMs = Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000
  await tokenRevocationStore.add(token, expiryMs)
}

export async function sendInvite(
  userId: string,
  baseUrl: string
): Promise<{ sent: boolean; error?: string; inviteLink?: string; channels?: string[] }> {
  try {
    const token = await createInviteToken(userId)
    const user = await findUserByIdAsync(userId)
    if (!user) return { sent: false, error: "User not found" }

    const link = `${baseUrl}/onboarding/invite?token=${encodeURIComponent(token)}`
    const title = "House of Veritas – Complete Your Onboarding"
    const message = `Welcome! Click to complete your onboarding: ${link}`

    const channels: ("email" | "sms" | "in_app")[] = ["in_app"]
    if (user.email) channels.unshift("email")
    if (user.phone) channels.push("sms")

    await sendNotification({
      type: "system_alert",
      userId,
      title,
      message,
      channels,
      data: { inviteLink: link },
      priority: "high",
    })

    logger.info("Invite sent", { userId, channels })
    return { sent: true, inviteLink: link, channels }
  } catch (err) {
    logger.error("Invite send failed", { error: err instanceof Error ? err.message : String(err) })
    return { sent: false, error: err instanceof Error ? err.message : String(err) }
  }
}
