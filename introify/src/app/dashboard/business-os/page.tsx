import { redirect } from "next/navigation"

import { BusinessOsShell } from "@/components/business-os/business-os-shell"
import { syncUser } from "@/lib/auth-sync"
import { listBusinessBlueprints, listBusinessEngines } from "@/lib/business-os"
import { requireSurface } from "@/lib/require-surface"

export const dynamic = "force-dynamic"

/**
 * Owner-facing Business OS surface.
 *
 * Reads the canonical blueprint registry directly, which is the same source the
 * `/api/business-os/blueprints` routes serve. There is no sample data and no internal
 * HTTP hop.
 *
 * Gated server-side by the `businessOs` surface, so removing the navigation entry is
 * not what protects it: a direct URL from a profile without the surface is redirected.
 */
export default async function DashboardBusinessOsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "businessOs", profile)

    return (
        <BusinessOsShell
            activeProfileId={profile.id}
            blueprints={listBusinessBlueprints()}
            engines={listBusinessEngines()}
        />
    )
}
