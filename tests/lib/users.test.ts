import { describe, expect, it } from "vitest"
import { USERS, findUserByEmail } from "@/lib/users"

describe("canonical user identity mappings", () => {
  it("maps the verified OmniPost email to Lucky without changing access", () => {
    expect(findUserByEmail("OMNIPOSTHQ@GMAIL.COM")).toMatchObject({
      id: "lucky",
      email: "omniposthq@gmail.com",
      role: "employee",
    })
  })

  it("does not retain Lucky's superseded email as an identity mapping", () => {
    expect(findUserByEmail("lucky@houseofv.com")).toBeUndefined()
  })

  it("keeps canonical email identity mappings unique", () => {
    const normalizedEmails = Object.values(USERS).map((user) => user.email.toLowerCase())

    expect(new Set(normalizedEmails).size).toBe(normalizedEmails.length)
  })
})
