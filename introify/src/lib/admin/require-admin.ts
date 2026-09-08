import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { userIsAdmin } from "@/lib/admin/allowlist"

export { isAdminEmail, userIsAdmin } from "@/lib/admin/allowlist"

export async function requireAdmin() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    if (!userIsAdmin(user)) redirect("/dashboard")
    return user
}
