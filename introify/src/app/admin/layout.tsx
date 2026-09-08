import { requireAdmin } from "@/lib/admin/require-admin"
import { AdminShell } from "@/components/admin/admin-shell"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await requireAdmin()
    return <AdminShell email={user.email}>{children}</AdminShell>
}
