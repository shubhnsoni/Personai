import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"

export const dynamic = "force-dynamic"

export default async function NewProductPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    if (!user.activeProfile) redirect("/onboarding")
    if (!user.activeProfile) redirect("/onboarding")
    redirect("/dashboard/products")
}
