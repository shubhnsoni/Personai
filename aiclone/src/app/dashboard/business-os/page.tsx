import { redirect } from "next/navigation"

import { BusinessOsShell } from "@/components/business-os/business-os-shell"
import { syncUser } from "@/lib/auth-sync"
import { listBusinessBlueprints, listBusinessEngines } from "@/lib/business-os"

export const dynamic = "force-dynamic"

/**
 * Owner-facing Business OS surface.
 *
 * Reads the canonical blueprint registry directly, which is the same source the
 * `/api/business-os/blueprints` routes serve. There is no sample data and no internal
 * HTTP hop.
 */
export default async function DashboardBusinessOsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    return (
        <BusinessOsShell
            blueprints={listBusinessBlueprints()}
            engines={listBusinessEngines()}
        />
    )
}
