import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { ACTIVE_PROFILE_COOKIE } from "@/lib/try-kits"
import { AdminKitsList } from "@/components/admin/admin-kits-list"
import { AdminPageHead } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"

export default async function AdminKitsPage() {
    const user = await requireAdmin()
    const jar = await cookies()
    const activeId = jar.get(ACTIVE_PROFILE_COOKIE)?.value
    const owned = await prisma.profile.findMany({
        where: { userId: user.id, slug: { startsWith: "try-" } },
        select: { id: true, slug: true, roleTemplate: true },
    })

    return (
        <div className="space-y-5">
            <AdminPageHead
                title="Kits"
                hint="Try every business profile. Open a temporary studio or walk through onboarding. Admins only — no shop required."
            />
            <AdminKitsList owned={owned} activeId={activeId} />
        </div>
    )
}
