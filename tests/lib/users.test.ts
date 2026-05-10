import { describe, it, expect } from "vitest"
import {
  USERS,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  verifyPassword,
  generateRandomPassword,
  setPassword,
  getPasswordHash,
  safeUser,
} from "@/lib/users"

describe("users", () => {
  describe("USERS store", () => {
    it("should contain the 4 named personas", () => {
      for (const id of ["hans", "charl", "lucky", "irma"]) {
        expect(USERS).toHaveProperty(id)
      }
    })

    it("should have bcrypt-hashed passwords", () => {
      for (const user of Object.values(USERS)) {
        expect(user.passwordHash).toMatch(/^\$2[aby]\$/)
      }
    })

    it("should assign correct roles", () => {
      expect(USERS.hans.role).toBe("admin")
      expect(USERS.irma.role).toBe("resident")
      expect(USERS.charl.role).toBe("operator")
      expect(USERS.lucky.role).toBe("employee")
    })
  })

  describe("findUserByEmail", () => {
    it("should find user with exact email", () => {
      const user = findUserByEmail("hans@houseofv.com")
      expect(user).toBeDefined()
      expect(user?.id).toBe("hans")
    })

    it("should be case insensitive", () => {
      const user = findUserByEmail("Hans@HouseOfV.com")
      expect(user?.id).toBe("hans")
    })

    it("should return undefined for unknown email", () => {
      expect(findUserByEmail("nobody@example.com")).toBeUndefined()
    })
  })

  describe("findUserById", () => {
    it("should find user by id", () => {
      expect(findUserById("charl")?.name).toBe("Charl")
    })

    it("should be case insensitive", () => {
      expect(findUserById("LUCKY")?.id).toBe("lucky")
    })

    it("should return undefined for unknown id", () => {
      expect(findUserById("unknown")).toBeUndefined()
    })
  })

  describe("findUserByPhone", () => {
    it("should find user by phone", () => {
      const user = findUserByPhone("+27692381255")
      expect(user?.id).toBe("hans")
    })

    it("should normalize whitespace", () => {
      const user = findUserByPhone("+27 692 381 255")
      expect(user?.id).toBe("hans")
    })
  })

  describe("verifyPassword", () => {
    it("should verify correct password", () => {
      expect(verifyPassword("hans123", USERS.hans.passwordHash)).toBe(true)
    }, 10000)

    it("should reject incorrect password", () => {
      expect(verifyPassword("wrong", USERS.hans.passwordHash)).toBe(false)
    }, 10000)
  })

  describe("password management", () => {
    it("should generate random password with 8 characters", () => {
      const pwd = generateRandomPassword()
      expect(pwd).toHaveLength(8)
      expect(pwd).toMatch(/^[A-Za-z0-9]+$/)
    })

    it("should allow password override and verify new password", () => {
      setPassword("hans", "newpass")
      const hash = getPasswordHash("hans")
      expect(hash).toMatch(/^\$2[aby]\$/)
      expect(verifyPassword("newpass", hash)).toBe(true)
      expect(verifyPassword("hans123", hash)).toBe(false)
    }, 10000)
  })

  describe("safeUser", () => {
    it("should exclude passwordHash", () => {
      const safe = safeUser(USERS.hans)
      expect(safe).not.toHaveProperty("passwordHash")
      expect(safe).toHaveProperty("id", "hans")
      expect(safe).toHaveProperty("email")
    })
  })
})
