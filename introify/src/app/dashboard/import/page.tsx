import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default function ImportPage() {
    redirect("/dashboard/profile?tab=import")
}
