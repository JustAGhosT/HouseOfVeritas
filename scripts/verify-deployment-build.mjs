const DEFAULT_ATTEMPTS = 10
const DEFAULT_DELAY_MS = 15_000

function parsePositiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}

function parseArguments(args) {
  const values = new Map()
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? "end of command"}`)
    }
    values.set(key.slice(2), value)
  }

  const url = values.get("url")
  const expectedCommit = values.get("expected")
  if (!url || !expectedCommit) {
    throw new Error("Usage: --url <health-url> --expected <git-sha> [--attempts N] [--delay-ms N]")
  }
  if (!/^[0-9a-f]{40}$/i.test(expectedCommit)) {
    throw new Error("--expected must be a full 40-character Git commit SHA")
  }

  return {
    url,
    expectedCommit: expectedCommit.toLowerCase(),
    attempts: values.has("attempts")
      ? parsePositiveInteger(values.get("attempts"), "--attempts")
      : DEFAULT_ATTEMPTS,
    delayMs: values.has("delay-ms")
      ? parsePositiveInteger(values.get("delay-ms"), "--delay-ms")
      : DEFAULT_DELAY_MS,
  }
}

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

export async function verifyDeploymentBuild({
  url,
  expectedCommit,
  attempts = DEFAULT_ATTEMPTS,
  delayMs = DEFAULT_DELAY_MS,
  fetchImpl = fetch,
  sleepImpl = sleep,
  now = Date.now,
  log = console.log,
}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const probeUrl = new URL(url)
    probeUrl.searchParams.set("expected_commit", expectedCommit)
    probeUrl.searchParams.set("attempt", String(attempt))
    probeUrl.searchParams.set("cache_bust", String(now()))

    try {
      const response = await fetchImpl(probeUrl, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, max-age=0",
          Pragma: "no-cache",
        },
      })
      const body = response.ok ? await response.json() : null
      const servedCommit = body?.build?.commit

      if (response.ok && body?.status === "healthy" && servedCommit === expectedCommit) {
        log(`Exact deployment is healthy: ${expectedCommit}`)
        return
      }

      log(
        `Waiting for exact deployment (attempt ${attempt}/${attempts}; HTTP ${response.status}; served ${servedCommit ?? "unknown"})`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown request error"
      log(`Waiting for exact deployment (attempt ${attempt}/${attempts}; ${message})`)
    }

    if (attempt < attempts) await sleepImpl(delayMs)
  }

  throw new Error(
    `Expected healthy deployment ${expectedCommit} was not served after ${attempts} attempts`
  )
}

if (process.argv[1]?.endsWith("verify-deployment-build.mjs")) {
  try {
    await verifyDeploymentBuild(parseArguments(process.argv.slice(2)))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
