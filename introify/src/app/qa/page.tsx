import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { userIsAdmin } from "@/lib/admin/allowlist"

export const dynamic = "force-dynamic"

/** Admin-only kits live at /admin/kits. Keep /qa as a stable alias. */
export default async function QaKitsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    if (!userIsAdmin(user)) redirect("/dashboard")
    redirect("/admin/kits")
}
