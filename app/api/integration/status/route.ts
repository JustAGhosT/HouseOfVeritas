import { NextResponse } from "next/server"
import { isDocuSealConfigured } from "@/lib/services/docuseal"
import { isBaserowConfigured } from "@/lib/services/baserow"

export async function GET() {
  const docusealConfigured = isDocuSealConfigured()
  const baserowConfigured = isBaserowConfigured()

  const services = {
    docuseal: {
      name: "DocuSeal",
      description: "E-Signature Platform",
      configured: docusealConfigured,
      status: docusealConfigured ? "connected" : "empty",
      endpoints: {
        api: process.env.DOCUSEAL_API_URL || "Not configured",
      },
    },
    baserow: {
      name: "Baserow",
      description: "Operational Database",
      configured: baserowConfigured,
      status: baserowConfigured ? "connected" : "empty",
      endpoints: {
        api: process.env.BASEROW_API_URL || "Not configured",
      },
    },
    twilio: {
      name: "Twilio",
      description: "SMS Notifications",
      configured: !!process.env.TWILIO_ACCOUNT_SID,
      status: process.env.TWILIO_ACCOUNT_SID ? "connected" : "empty",
      endpoints: {
        api: "https://api.twilio.com",
      },
    },
  }

  const allConfigured = docusealConfigured && baserowConfigured
  const overallStatus = allConfigured ? "production" : "development"

  return NextResponse.json({
    status: overallStatus,
    message: allConfigured
      ? "All services connected - running in production mode"
      : "Some services are not configured",
    services,
    environment: {
      nodeEnv: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    },
  })
}
