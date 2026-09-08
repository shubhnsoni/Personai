import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default function DashboardContentPage() {
    redirect("/dashboard/profile?tab=knowledge")
}
