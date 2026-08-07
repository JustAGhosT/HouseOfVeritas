import { rateLimitAsync } from "@/lib/auth/rate-limit"
import { getAuthContext, isAdminOrOperator, withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { toISODateString } from "@/lib/utils"
import { NextResponse } from "next/server"

const ASSET_RATE_LIMIT = 100
const ASSET_RATE_WINDOW_MS = 15 * 60 * 1000

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseInt((await params).id, 10)
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 })
  }
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  const rl = await rateLimitAsync(`asset:${ip}:${id}`, ASSET_RATE_LIMIT, ASSET_RATE_WINDOW_MS)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 })
  }
  try {
    const asset = await getEstateRepository().assets.get(id)
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    }
    return NextResponse.json({ asset })
  } catch (error) {
    logger.error("GET asset error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch asset" }, { status: 500 })
  }
}

export const PATCH = withRole(
  "admin",
  "operator"
)(async (request, context) => {
  try {
    const params = (await (context.params ?? Promise.resolve({}))) as { id?: string }
    const idParam = params?.id
    if (!idParam) {
      return NextResponse.json({ error: "Asset ID required" }, { status: 400 })
    }
    const id = parseInt(idParam, 10)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json({ error: "Malformed JSON in request body" }, { status: 400 })
      }
      throw err
    }
    const { action, checkedOutBy, expectedReturnDate, personaId } = body

    const asset = await getEstateRepository().assets.get(id)
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    }

    if (action === "checkout") {
      if (asset.checkedOutBy) {
        return NextResponse.json({ error: "Asset is already checked out" }, { status: 400 })
      }

      const lockoutUntil = asset.lateReturnLockoutUntil
      if (lockoutUntil) {
        const todayStr = toISODateString(new Date())
        if (lockoutUntil > todayStr) {
          return NextResponse.json(
            {
              error: "Checkout blocked: asset has late return lockout until " + lockoutUntil,
            },
            { status: 403 }
          )
        }
      }

      if (typeof expectedReturnDate !== "string" || !expectedReturnDate.trim()) {
        return NextResponse.json(
          { error: "expectedReturnDate is required for checkout" },
          { status: 400 }
        )
      }

      // Derive caller identity strictly from request header (authorization bypass protection)
      const callerId = request.headers.get("x-user-id")
      if (!callerId) {
        return NextResponse.json(
          { error: "Unauthorized: x-user-id header is required" },
          { status: 401 }
        )
      }

      // Only allow checkedOutBy to differ from callerId if caller has elevated privileges
      let userInput: string
      if (typeof checkedOutBy === "string" && checkedOutBy) {
        // Check if caller is trying to set checkedOutBy to a different user
        if (checkedOutBy !== callerId) {
          const auth = getAuthContext(request)
          if (!auth || !isAdminOrOperator(auth.role)) {
            return NextResponse.json(
              {
                error:
                  "Forbidden: Cannot check out asset on behalf of another user without admin/operator privileges",
              },
              { status: 403 }
            )
          }
        }
        userInput = checkedOutBy
      } else {
        // In else branch, checkedOutBy is falsy and callerId is guaranteed to exist
        userInput = callerId
      }
      const employeeId = (await getEstateRepository().employees.resolveIdByAppId(userInput)) ?? undefined
      if (!employeeId) {
        return NextResponse.json(
          { error: "Could not resolve checkout user to employee" },
          { status: 400 }
        )
      }

      const today = toISODateString()
      const updated = await getEstateRepository().assets.update(id, {
        checkedOutBy: employeeId,
        checkOutDate: today,
        expectedReturnDate: expectedReturnDate.trim(),
      })
      if (!updated) {
        return NextResponse.json({ error: "Asset update failed" }, { status: 500 })
      }
      return NextResponse.json({ asset: updated })
    }

    if (action === "checkin") {
      if (!asset.checkedOutBy) {
        return NextResponse.json({ error: "Asset is not checked out" }, { status: 400 })
      }

      const updated = await getEstateRepository().assets.update(id, {
        checkedOutBy: null,
        checkOutDate: null,
        expectedReturnDate: null,
      })
      if (!updated) {
        return NextResponse.json({ error: "Asset update failed" }, { status: 500 })
      }
      return NextResponse.json({ asset: updated })
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'checkout' or 'checkin'" },
      { status: 400 }
    )
  } catch (error) {
    logger.error("PATCH asset error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 })
  }
})
