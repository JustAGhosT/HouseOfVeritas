import { NextResponse } from "next/server"
import { isBaserowConfigured } from "@/lib/services/baserow"

interface DataSourceOptions {
  configured?: boolean
  message?: string
}

/** Wraps data with Baserow connection status for consistent API responses */
export function withDataSource<T extends Record<string, unknown>>(
  data: T,
  options?: DataSourceOptions
) {
  const configured = options?.configured ?? isBaserowConfigured()
  const dataSourceMessage =
    options?.message ?? (configured ? "Connected to Baserow" : "Baserow not configured")
  return NextResponse.json({
    ...data,
    configured,
    message: (data.message as string) ?? dataSourceMessage,
  })
}
