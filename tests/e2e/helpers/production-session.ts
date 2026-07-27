const DEFAULT_SESSION_COOKIE_NAME = "__Secure-authjs.session-token"

export type ProbeRole = "admin" | "operator"

export type SessionCookie = {
  name: string
  value: string
}

type SessionEnvironment = Readonly<Record<string, string | undefined>>

function environmentPrefix(role: ProbeRole) {
  return role === "admin" ? "POST_DEPLOY_ADMIN_SESSION" : "POST_DEPLOY_OPERATOR_SESSION"
}

function cookieBaseName(role: ProbeRole, environment: SessionEnvironment) {
  return environment[`${environmentPrefix(role)}_COOKIE_NAME`] ?? DEFAULT_SESSION_COOKIE_NAME
}

function isExpectedCookieName(name: string, baseName: string) {
  if (name === baseName) {
    return true
  }

  const chunkSuffix = name.slice(baseName.length + 1)
  return name.startsWith(`${baseName}.`) && /^\d+$/.test(chunkSuffix)
}

function parseChunkedCookies(
  role: ProbeRole,
  serializedCookies: string,
  environment: SessionEnvironment
): SessionCookie[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(serializedCookies)
  } catch {
    throw new Error(`${environmentPrefix(role)}_COOKIES must be a valid JSON array.`)
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${environmentPrefix(role)}_COOKIES must contain at least one cookie.`)
  }

  const baseName = cookieBaseName(role, environment)
  const cookies = parsed.map((candidate, index) => {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      typeof candidate.name !== "string" ||
      candidate.name.length === 0 ||
      typeof candidate.value !== "string" ||
      candidate.value.length === 0
    ) {
      throw new Error(
        `${environmentPrefix(role)}_COOKIES entry ${index} must have non-empty name and value strings.`
      )
    }

    if (!isExpectedCookieName(candidate.name, baseName)) {
      throw new Error(
        `${environmentPrefix(role)}_COOKIES entry ${index} must use ${baseName} or a numeric chunk suffix.`
      )
    }

    return { name: candidate.name, value: candidate.value }
  })

  if (new Set(cookies.map(({ name }) => name)).size !== cookies.length) {
    throw new Error(`${environmentPrefix(role)}_COOKIES must not contain duplicate cookie names.`)
  }

  return cookies
}

export function productionSessionCookies(
  role: ProbeRole,
  environment: SessionEnvironment = process.env
): SessionCookie[] {
  const prefix = environmentPrefix(role)
  const serializedCookies = environment[`${prefix}_COOKIES`]

  if (serializedCookies !== undefined) {
    return parseChunkedCookies(role, serializedCookies, environment)
  }

  const sessionToken = environment[prefix]
  if (!sessionToken) {
    return []
  }

  return [{ name: cookieBaseName(role, environment), value: sessionToken }]
}
