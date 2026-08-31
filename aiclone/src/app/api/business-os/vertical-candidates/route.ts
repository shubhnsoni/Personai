import { NextRequest } from "next/server"

import { listBusinessBlueprints } from "@/lib/business-os"
import { requireBusinessOsAccess } from "@/lib/business-os/api/guard"
import { MAX_BLUEPRINT_LIMIT, parseBlueprintId, parseLimit } from "@/lib/business-os/api/params"
import { businessOsError, businessOsJson } from "@/lib/business-os/api/responses"
import {
    CANDIDATE_SURFACE_NOTICE,
    toVerticalCandidateView,
} from "@/lib/business-os/api/serialize-vertical-candidates"
import { getVerticalPackCandidate, listVerticalPackCandidates } from "@/lib/business-os/vertical-packs"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * UNREGISTERED vertical pack candidates. READ-ONLY, and behind the owner console surface.
 *
 * AUTHORIZATION, AT THIS REAL SERVER BOUNDARY. `requireBusinessOsAccess()` is the first thing that runs
 * and nothing is read before it returns ok: the caller must be signed in (syncUser) AND hold the
 * `businessOs` surface on their first profile. `businessOs` is deliberately absent from ALL_SURFACES in
 * src/lib/surfaces.ts, so it is never granted by a role template - only by an explicit per-profile
 * opt-in. A page gate alone would be cosmetic while this data was readable over HTTP, which is the same
 * reasoning /api/business-os/blueprints was built on, and this route follows it exactly.
 *
 * ONLY GET IS EXPORTED, and that is load-bearing rather than incidental. There is no POST, PUT, PATCH or
 * DELETE here and there must never be one: a state-changing verb on this path would be the beginning of
 * an install surface for something the repository guarantees is not installable. HEAD and OPTIONS are
 * derived by the framework from GET; both are safe methods under RFC 9110 section 9.2.1.
 *
 * NOTHING BECOMES REGISTERED OR INSTALLABLE HERE. This handler calls two readers
 * (`listVerticalPackCandidates`, `getVerticalPackCandidate`) and one serializer. It touches no database,
 * writes no row, mutates no module state, and never pushes a candidate into the blueprint registry -
 * `registeredInRegistry` below is MEASURED against `listBusinessBlueprints()` on every request rather
 * than asserted, so a candidate that somehow reached the registry would be reported by this payload
 * instead of hidden by it.
 *
 * NON-ENUMERATION. Every refusal comes out of the shared envelope with a message that does not depend on
 * what the caller asked for, and the NOT_FOUND branch deliberately does NOT echo the requested id back
 * (which is where this diverges from the [blueprintId] route). So an unauthenticated or surface-less
 * caller sees byte-identical bodies whether the id they guessed exists or not, and one unknown id is
 * indistinguishable from another.
 */
export async function GET(req: NextRequest) {
    try {
        const access = await requireBusinessOsAccess()
        if (!access.ok) return access.response

        const requestedId = req.nextUrl.searchParams.get("id")

        if (requestedId !== null) {
            const parsedId = parseBlueprintId(requestedId)
            if (!parsedId) {
                return businessOsError("BAD_REQUEST", "id must be a URL-safe identifier", { field: "id" })
            }

            const candidate = getVerticalPackCandidate(parsedId)
            if (!candidate) {
                // No id in the message and no id in the details: two different unknown ids must be
                // indistinguishable, or this response enumerates by elimination.
                return businessOsError("NOT_FOUND", "Business OS vertical pack candidate was not found")
            }

            return businessOsJson({
                readOnly: true,
                installable: false,
                notice: CANDIDATE_SURFACE_NOTICE,
                candidate: toVerticalCandidateView(candidate),
            })
        }

        const limit = parseLimit(req.nextUrl.searchParams.get("limit"))
        if (limit === null) {
            return businessOsError("BAD_REQUEST", `limit must be an integer from 1 to ${MAX_BLUEPRINT_LIMIT}`, {
                field: "limit",
            })
        }

        const candidates = listVerticalPackCandidates()
        const registryIds = new Set(listBusinessBlueprints().map((blueprint) => blueprint.id))
        const registeredInRegistry = candidates.filter((candidate) => registryIds.has(candidate.blueprint.id)).length

        return businessOsJson({
            total: candidates.length,
            readOnly: true,
            installable: false,
            /** MEASURED against the live registry on every request, not declared. Expected: 0. */
            registeredInRegistry,
            notice: CANDIDATE_SURFACE_NOTICE,
            candidates: candidates.slice(0, limit).map(toVerticalCandidateView),
        })
    } catch {
        // syncUser can throw on an unverified email re-link and Prisma can throw; neither may escape
        // the response envelope as a stack.
        return businessOsError("INTERNAL_ERROR", "Business OS vertical pack candidates could not be read")
    }
}
