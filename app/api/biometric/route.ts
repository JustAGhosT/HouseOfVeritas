import { NextResponse } from "next/server"
import {
  clockInByAppId,
  clockOutByAppId,
  getTimeClockEntries,
  isBaserowConfigured,
} from "@/lib/services/baserow"
import { withAuth } from "@/lib/auth/rbac"

// Biometric device configuration
const BIOMETRIC_CONFIG = {
  deviceApiKey: process.env.BIOMETRIC_API_KEY,
  deviceEndpoint: process.env.BIOMETRIC_ENDPOINT,
}

// Check if biometric system is configured
export function isBiometricConfigured(): boolean {
  return !!(BIOMETRIC_CONFIG.deviceApiKey && BIOMETRIC_CONFIG.deviceEndpoint)
}

const DEMO_DATA_ENABLED = process.env.ALLOW_DEMO_DATA === "true"

// Employee biometric data (mock)
interface BiometricEmployee {
  id: string
  name: string
  fingerprintId: string
  faceId: string
  enrolledAt: string
  lastVerification: string | null
}

const ENROLLED_EMPLOYEES: BiometricEmployee[] = DEMO_DATA_ENABLED
  ? [
      {
        id: "charl",
        name: "Charl",
        fingerprintId: "FP_001",
        faceId: "FACE_001",
        enrolledAt: "2025-01-15T09:00:00Z",
        lastVerification: "2026-02-20T07:02:15Z",
      },
      {
        id: "lucky",
        name: "Lucky",
        fingerprintId: "FP_002",
        faceId: "FACE_002",
        enrolledAt: "2025-01-15T09:15:00Z",
        lastVerification: "2026-02-20T06:28:45Z",
      },
      {
        id: "irma",
        name: "Irma",
        fingerprintId: "FP_003",
        faceId: "FACE_003",
        enrolledAt: "2025-01-15T09:30:00Z",
        lastVerification: "2026-02-20T07:55:30Z",
      },
    ]
  : []

// Time clock records (in-memory store)
interface ClockRecord {
  id: string
  employeeId: string
  employeeName: string
  type: "clock_in" | "clock_out"
  method: "fingerprint" | "face" | "pin" | "manual"
  timestamp: string
  location?: string
  verified: boolean
  deviceId?: string
}

let clockRecords: ClockRecord[] = DEMO_DATA_ENABLED
  ? [
      {
        id: "clk_001",
        employeeId: "charl",
        employeeName: "Charl",
        type: "clock_in",
        method: "fingerprint",
        timestamp: "2026-02-20T07:02:15Z",
        location: "Workshop Entrance",
        verified: true,
        deviceId: "BIO_DEVICE_01",
      },
      {
        id: "clk_002",
        employeeId: "lucky",
        employeeName: "Lucky",
        type: "clock_in",
        method: "face",
        timestamp: "2026-02-20T06:28:45Z",
        location: "Garden Gate",
        verified: true,
        deviceId: "BIO_DEVICE_02",
      },
      {
        id: "clk_003",
        employeeId: "irma",
        employeeName: "Irma",
        type: "clock_in",
        method: "fingerprint",
        timestamp: "2026-02-20T07:55:30Z",
        location: "Main House",
        verified: true,
        deviceId: "BIO_DEVICE_01",
      },
    ]
  : []

function getBiometricMode(): "demo" | "empty" | "live" {
  if (isBiometricConfigured()) return "live"
  return DEMO_DATA_ENABLED ? "demo" : "empty"
}

// GET - Get biometric status, enrolled employees, or clock records
export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")
  const employeeId = searchParams.get("employeeId")
  const date = searchParams.get("date")

  // Check system status
  if (action === "status") {
    return NextResponse.json({
      configured: isBiometricConfigured(),
      mode: getBiometricMode(),
      devices: DEMO_DATA_ENABLED
        ? [
            {
              id: "BIO_DEVICE_01",
              location: "Workshop Entrance",
              status: "online",
              type: "fingerprint+face",
            },
            { id: "BIO_DEVICE_02", location: "Garden Gate", status: "online", type: "fingerprint" },
            {
              id: "BIO_DEVICE_03",
              location: "Main House",
              status: "online",
              type: "fingerprint+face",
            },
          ]
        : [],
      enrolledEmployees: ENROLLED_EMPLOYEES.length,
      todayRecords: clockRecords.filter((r) =>
        r.timestamp.startsWith(new Date().toISOString().split("T")[0])
      ).length,
      note: isBiometricConfigured()
        ? "Biometric system connected"
        : "Configure BIOMETRIC_API_KEY for live integration.",
    })
  }

  // Get enrolled employees
  if (action === "enrolled") {
    return NextResponse.json({
      mode: getBiometricMode(),
      employees: ENROLLED_EMPLOYEES,
    })
  }

  const today = new Date().toISOString().split("T")[0]
  let records = [...clockRecords]

  if (isBaserowConfigured()) {
    const baserowEntries = await getTimeClockEntries({
      date: date || today,
    })
    const baserowRecords: ClockRecord[] = []
    for (const e of baserowEntries) {
      const empId = e.employeeName?.toLowerCase().split(" ")[0] || String(e.employee)
      const empName = e.employeeName || ""
      if (e.clockIn) {
        baserowRecords.push({
          id: `clk_baserow_${e.id}_in`,
          employeeId: empId,
          employeeName: empName,
          type: "clock_in",
          method: "manual",
          timestamp: `${e.date}T${e.clockIn}:00.000Z`,
          location: "Baserow",
          verified: true,
        })
      }
      if (e.clockOut) {
        baserowRecords.push({
          id: `clk_baserow_${e.id}_out`,
          employeeId: empId,
          employeeName: empName,
          type: "clock_out",
          method: "manual",
          timestamp: `${e.date}T${e.clockOut}:00.000Z`,
          location: "Baserow",
          verified: true,
        })
      }
    }
    records = [...baserowRecords, ...clockRecords]
  }

  if (employeeId) {
    records = records.filter((r) => r.employeeId === employeeId)
  }

  if (date) {
    records = records.filter((r) => r.timestamp.startsWith(date))
  }

  const todayRecords = records.filter((r) => r.timestamp.startsWith(today))

  const employeeStatus = ENROLLED_EMPLOYEES.map((emp) => {
    const empRecords = todayRecords.filter((r) => r.employeeId === emp.id)
    const clockIn = empRecords.find((r) => r.type === "clock_in")
    const clockOut = empRecords.find((r) => r.type === "clock_out")

    let hoursWorked = 0
    let status = "not_clocked_in"

    if (clockIn && clockOut) {
      hoursWorked =
        (new Date(clockOut.timestamp).getTime() - new Date(clockIn.timestamp).getTime()) / 3600000
      status = "completed"
    } else if (clockIn) {
      hoursWorked = (Date.now() - new Date(clockIn.timestamp).getTime()) / 3600000
      status = "working"
    }

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      status,
      clockIn: clockIn?.timestamp || null,
      clockOut: clockOut?.timestamp || null,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
    }
  })

  return NextResponse.json({
    mode: getBiometricMode(),
    date: date || today,
    records,
    employeeStatus,
    summary: {
      totalRecords: records.length,
      clockIns: records.filter((r) => r.type === "clock_in").length,
      clockOuts: records.filter((r) => r.type === "clock_out").length,
    },
  })
})

// POST - Clock in/out or enroll employee
export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { action, employeeId, method = "fingerprint", location, biometricData } = body

    // Clock in/out
    if (action === "clock_in" || action === "clock_out") {
      if (!employeeId) {
        return NextResponse.json({ error: "employeeId required" }, { status: 400 })
      }

      const employee = ENROLLED_EMPLOYEES.find((e) => e.id === employeeId)
      if (!employee) {
        return NextResponse.json({ error: "Employee not enrolled" }, { status: 404 })
      }

      const verified = true

      const record: ClockRecord = {
        id: `clk_${Date.now()}`,
        employeeId,
        employeeName: employee.name,
        type: action,
        method: method as ClockRecord["method"],
        timestamp: new Date().toISOString(),
        location: location || "Main Entrance",
        verified,
        deviceId: "BIO_DEVICE_01",
      }

      clockRecords.push(record)

      if (isBaserowConfigured()) {
        if (action === "clock_in") {
          await clockInByAppId(employeeId)
        } else {
          await clockOutByAppId(employeeId)
        }
      }

      return NextResponse.json({
        success: true,
        mode: getBiometricMode(),
        record,
        persisted: isBaserowConfigured(),
        message: `${employee.name} ${action === "clock_in" ? "clocked in" : "clocked out"} successfully`,
      })
    }

    // Enroll new employee (mock)
    if (action === "enroll") {
      if (!employeeId) {
        return NextResponse.json({ error: "employeeId required" }, { status: 400 })
      }

      // In production: capture and store biometric template
      return NextResponse.json({
        success: true,
        mode: getBiometricMode(),
        message: `Employee enrollment initiated. In production, biometric capture would occur.`,
        instructions: [
          "1. Position finger on scanner",
          "2. Wait for green light",
          "3. Repeat 3 times for fingerprint enrollment",
          "4. Look at camera for face enrollment",
        ],
      })
    }

    // Verify biometric (for door access, etc.)
    if (action === "verify") {
      if (!employeeId && !biometricData) {
        return NextResponse.json({ error: "employeeId or biometricData required" }, { status: 400 })
      }

      // Mock verification - always succeeds
      const employee = ENROLLED_EMPLOYEES.find((e) => e.id === employeeId)

      return NextResponse.json({
        success: true,
        verified: true,
        confidence: 0.98,
        employee: employee
          ? {
              id: employee.id,
              name: employee.name,
            }
          : null,
        message: "Biometric verification successful",
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: "Biometric operation failed" }, { status: 500 })
  }
})
