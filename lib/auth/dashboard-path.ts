export const PERSONA_IDS = ["hans", "charl", "irma", "lucky"] as const
export type PersonaId = (typeof PERSONA_IDS)[number]

const ROLE_TO_PERSONA: Record<string, PersonaId> = {
  admin: "hans",
  operator: "charl",
  resident: "irma",
  employee: "lucky",
}

export function isPersonaId(id: string | undefined | null): id is PersonaId {
  if (!id) return false
  return (PERSONA_IDS as readonly string[]).includes(id.toLowerCase())
}

export function getDashboardPath(userId: string, role: string): string {
  if (isPersonaId(userId)) return `/dashboard/${userId.toLowerCase()}`
  return `/dashboard/${ROLE_TO_PERSONA[role] ?? "hans"}`
}
