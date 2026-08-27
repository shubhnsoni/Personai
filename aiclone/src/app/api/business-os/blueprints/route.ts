import { NextRequest } from "next/server"

import { listBusinessBlueprints } from "@/lib/business-os"
import { requireBusinessOsAccess } from "@/lib/business-os/api/guard"
import { MAX_BLUEPRINT_LIMIT, parseLimit } from "@/lib/business-os/api/params"
import { businessOsError, businessOsJson } from "@/lib/business-os/api/responses"
import { toBlueprintSummary } from "@/lib/business-os/api/serialize"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Blueprint list. Owner-facing operations configuration, so it requires a signed-in user
 * who holds the `businessOs` surface.
 */
export async function GET(req: NextRequest) {
    try {
        const access = await requireBusinessOsAccess()
        if (!access.ok) return access.response

        const limit = parseLimit(req.nextUrl.searchParams.get("limit"))
        if (limit === null) {
            return businessOsError("BAD_REQUEST", `limit must be an integer from 1 to ${MAX_BLUEPRINT_LIMIT}`, {
                field: "limit",
            })
        }

        const blueprints = listBusinessBlueprints()

        return businessOsJson({
            total: blueprints.length,
            blueprints: blueprints.slice(0, limit).map(toBlueprintSummary),
        })
    } catch {
        // `syncUser` can throw on an unverified email re-link and Prisma can throw;
        // neither should escape the response envelope.
        return businessOsError("INTERNAL_ERROR", "Business OS blueprints could not be read")
    }
}
