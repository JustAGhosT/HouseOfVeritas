import { NextResponse } from "next/server"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { isDocuSealConfigured } from "@/lib/services/docuseal"

export const dynamic = "force-dynamic"

const buildCommit = process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "development"

async function checkService(
  name: string,
  url: string | undefined,
  path: string
): Promise<{ name: string; status: "up" | "down" | "unconfigured"; latencyMs: number | null }> {
  if (!url) return { name, status: "unconfigured", latencyMs: null }

  const start = Date.now()
  try {
    const res = await fetch(`${url}${path}`, {
      signal: AbortSignal.timeout(5000),
    })
    const latencyMs = Date.now() - start
    return { name, status: res.ok ? "up" : "down", latencyMs }
  } catch {
    return { name, status: "down", latencyMs: Date.now() - start }
  }
}

function serviceBaseUrl(url: string | undefined): string | undefined {
  return url?.replace(/\/api\/?$/, "").replace(/\/$/, "")
}

export async function GET() {
  const estate = getEstateRepository()

  // Probe Baserow only when Baserow is the store actually in use. This used to
  // key off `estate.isConfigured()`, which conflated "the estate repository is
  // configured" with "Baserow is configured" — fine while Baserow was the only
  // backend, wrong the moment ESTATE_BACKEND=postgres. On cutover it started
  // pinging a Baserow instance that had never been configured, which answered
  // "down" and reported the whole service degraded while it was in fact healthy.
  const baserowInUse = estate.backend === "baserow" && estate.isConfigured()

  const checks = await Promise.all([
    checkService(
      "baserow",
      baserowInUse
        ? serviceBaseUrl(process.env.BASEROW_API_URL || process.env.NEXT_PUBLIC_BASEROW_URL)
        : undefined,
      "/api/_health/"
    ),
    checkService(
      "docuseal",
      isDocuSealConfigured()
        ? serviceBaseUrl(process.env.NEXT_PUBLIC_DOCUSEAL_URL || process.env.DOCUSEAL_API_URL)
        : undefined,
      "/health"
    ),
  ])

  const overall = checks.every((c) => c.status === "up" || c.status === "unconfigured")

  return NextResponse.json(
    {
      status: overall ? "healthy" : "degraded",
      build: { commit: buildCommit },
      // Which store is actually backing estate data. Reported because "is this
      // deployment on Postgres yet?" was previously only answerable by reading
      // app settings, and dataMode alone cannot distinguish the backends.
      backend: estate.backend,
      dataMode: estate.isConfigured()
        ? "live"
        : process.env.ALLOW_DEMO_DATA === "true"
          ? "demo"
          : "empty",
      services: checks,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Expires: "0",
        Pragma: "no-cache",
      },
    }
  )
}
