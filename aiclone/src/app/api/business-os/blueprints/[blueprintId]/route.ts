import { NextRequest } from "next/server"

import { syncUser } from "@/lib/auth-sync"
import { getBusinessBlueprint, validateBusinessBlueprint } from "@/lib/business-os"
import { businessOsError, businessOsJson } from "@/lib/business-os/api/responses"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ blueprintId: string }>
}

function parseBlueprintId(value: string): string | null {
  const id = decodeURIComponent(value).trim()

  if (!/^[a-z0-9][a-z0-9-]{2,79}$/u.test(id)) return null

  return id
}

/** Single blueprint, including its validation result so a draft can be inspected. */
export async function GET(_req: NextRequest, context: RouteContext) {
  const user = await syncUser()
  if (!user) {
    return businessOsError("UNAUTHORIZED", "Sign in to read Business OS blueprints")
  }

  const { blueprintId } = await context.params
  const parsedId = parseBlueprintId(blueprintId)

  if (!parsedId) {
    return businessOsError("BAD_REQUEST", "blueprintId must be a URL-safe identifier", {
      field: "blueprintId",
    })
  }

  const blueprint = getBusinessBlueprint(parsedId)

  if (!blueprint) {
    return businessOsError("NOT_FOUND", "Business OS blueprint was not found", {
      blueprintId: parsedId,
    })
  }

  return businessOsJson({ blueprint, validation: validateBusinessBlueprint(blueprint) })
}
