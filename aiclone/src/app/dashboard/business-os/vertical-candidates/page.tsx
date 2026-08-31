import { redirect } from "next/navigation"

import {
    VerticalCandidateCatalog,
    type VerticalCandidateCatalogState,
} from "@/components/business-os/vertical-candidate-catalog"
import { syncUser } from "@/lib/auth-sync"
import { listBusinessBlueprints } from "@/lib/business-os"
import { requireSurface } from "@/lib/require-surface"

export const dynamic = "force-dynamic"

/**
 * Owner-facing VERTICAL CANDIDATE CATALOG - read-only.
 *
 * PROTECTION. Identical to the neighbouring `../page.tsx`, deliberately and line for line: a
 * `syncUser()` session or redirect to sign-in, a resolved profile or redirect to onboarding, then
 * `requireSurface(profile.roleTemplate, "businessOs", profile)`. That is the REAL server boundary -
 * this is a server component, so the check runs before any markup exists, and a direct URL from a
 * profile without the `businessOs` surface is redirected rather than rendered. No new auth mechanism
 * is introduced here and no authorization is broadened: this route is reachable by exactly the set
 * of profiles that can already reach the Business OS console.
 *
 * DATA. Reads `listVerticalPackCandidates()` DIRECTLY, which is the already-integrated source, and
 * `listBusinessBlueprints()` for the live registry the catalog checks registration and the alias
 * fingerprint against. No internal HTTP hop, and deliberately no dependency on any candidate API
 * route - the route being built in parallel is not needed here and is not imported.
 *
 * WHAT THIS ROUTE CANNOT DO. It is a GET-rendered server component with no action, no route handler
 * and no mutation of any kind. It does not touch `blueprints.ts`, onboarding activation or install
 * choices, so nothing becomes registered or installable through this surface.
 *
 * STATES. This page can only ever produce two of the catalog's five states: `ready` (including its
 * empty case, when the candidate package declares nothing) and `dependency-error`, when the
 * candidate package's own load-time validation throws. The other three are honest states of the
 * COMPONENT rather than of this route - `unauthorized` and `forbidden` cannot be reached here
 * because the server boundary above redirects those callers before render, which is a stronger
 * outcome than rendering a denial. They exist so the component cannot be mounted anywhere else and
 * silently imply a signed-in owner, and every one of the five is rendered and asserted by
 * `scripts/one-off/check-vertical-candidate-catalog.ts`.
 */
export default async function DashboardVerticalCandidatesPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "businessOs", profile)

    let state: VerticalCandidateCatalogState
    try {
        // Imported DYNAMICALLY on purpose. The candidate package validates every blueprint against
        // the real contract at MODULE LOAD and throws on a malformed one. A static top-level import
        // would make that throw a module-evaluation failure this function could never catch, so the
        // honest dependency-error state would be unreachable. Awaiting the import inside the try is
        // what makes it real: a malformed candidate renders an honest error with no candidate list,
        // instead of an unexplained 500 or a partial one.
        const { listVerticalPackCandidates } = await import("@/lib/business-os/vertical-packs")
        state = {
            kind: "ready",
            candidates: listVerticalPackCandidates(),
            registeredBlueprints: listBusinessBlueprints(),
        }
    } catch (error) {
        state = {
            kind: "dependency-error",
            detail: error instanceof Error ? error.message : undefined,
        }
    }

    return <VerticalCandidateCatalog state={state} />
}
