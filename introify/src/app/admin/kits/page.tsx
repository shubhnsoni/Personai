import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { ACTIVE_PROFILE_COOKIE } from "@/lib/try-kits"
import { AdminKitsList } from "@/components/admin/admin-kits-list"

export const dynamic = "force-dynamic"

export default async function AdminKitsPage() {
    const user = await requireAdmin()
    const jar = await cookies()
    const activeId = jar.get(ACTIVE_PROFILE_COOKIE)?.value
    const owned = await prisma.profile.findMany({
        where: { userId: user.id, slug: { startsWith: "try-" } },
        select: { id: true, roleTemplate: true },
    })

    return (
        <div className="space-y-5">
            <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Platform</p>
                <h1 className="text-2xl font-semibold tracking-tight">Kits</h1>
                <p className="text-sm text-muted-foreground">
                    Try every business profile. Open a temporary studio or walk through its onboarding. Admins only — no shop required.
                </p>
            </div>
            <AdminKitsList owned={owned} activeId={activeId} />
        </div>
    )
}
