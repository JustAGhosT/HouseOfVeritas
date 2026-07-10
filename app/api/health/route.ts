import { NextResponse } from "next/server"
import { isBaserowConfigured } from "@/lib/services/baserow"
import { isDocuSealConfigured } from "@/lib/services/docuseal"

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
  const checks = await Promise.all([
    checkService(
      "baserow",
      isBaserowConfigured()
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

  return NextResponse.json({
    status: overall ? "healthy" : "degraded",
    dataMode: isBaserowConfigured()
      ? "live"
      : process.env.ALLOW_DEMO_DATA === "true"
        ? "demo"
        : "empty",
    services: checks,
    timestamp: new Date().toISOString(),
  })
}
