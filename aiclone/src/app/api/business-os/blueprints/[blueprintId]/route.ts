import { NextRequest } from "next/server"

import { getBusinessBlueprint, validateBusinessBlueprint } from "@/lib/business-os"
import { requireBusinessOsAccess } from "@/lib/business-os/api/guard"
import { parseBlueprintId } from "@/lib/business-os/api/params"
import { businessOsError, businessOsJson } from "@/lib/business-os/api/responses"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = {
    params: Promise<{ blueprintId: string }>
}

/**
 * Single blueprint.
 *
 * `validation` is returned so a caller never has to assume validity. Today the registry
 * asserts on load, so a served blueprint is always valid; the field exists so that a
 * future dynamic or owner-authored source can report issues through the same shape.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
    try {
        const access = await requireBusinessOsAccess()
        if (!access.ok) return access.response

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
    } catch {
        return businessOsError("INTERNAL_ERROR", "Business OS blueprint could not be read")
    }
}
