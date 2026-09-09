import { requireAdmin } from "@/lib/admin/require-admin"
import { AdminShell } from "@/components/admin/admin-shell"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await requireAdmin()
    const supportCount = await prisma.conversation.count({
        where: { mode: "LIVE_REQUESTED" },
    }).catch(() => 0)
    return (
        <AdminShell email={user.email} supportCount={supportCount}>
            {children}
        </AdminShell>
    )
}

