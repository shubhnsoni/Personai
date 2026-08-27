import { NextRequest } from "next/server"

import { syncUser } from "@/lib/auth-sync"
import { listBusinessBlueprints } from "@/lib/business-os"
import { businessOsError, businessOsJson } from "@/lib/business-os/api/responses"
import { toBlueprintSummary } from "@/lib/business-os/api/serialize"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_LIMIT = 50

function parseLimit(value: string | null): number | null {
  if (!value) return MAX_LIMIT

  const limit = Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return null

  return limit
}

/**
 * Blueprint list. Owner-facing operations configuration, so it requires a signed-in
 * user rather than being world-readable.
 */
export async function GET(req: NextRequest) {
  const user = await syncUser()
  if (!user) {
    return businessOsError("UNAUTHORIZED", "Sign in to read Business OS blueprints")
  }

  const limit = parseLimit(req.nextUrl.searchParams.get("limit"))
  if (limit === null) {
    return businessOsError("BAD_REQUEST", `limit must be an integer from 1 to ${MAX_LIMIT}`, {
      field: "limit",
    })
  }

  const blueprints = listBusinessBlueprints()

  return businessOsJson({
    total: blueprints.length,
    blueprints: blueprints.slice(0, limit).map(toBlueprintSummary),
  })
}
