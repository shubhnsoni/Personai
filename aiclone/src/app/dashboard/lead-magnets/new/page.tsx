import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default function NewLeadMagnetPage() {
    redirect("/dashboard/lead-magnets")
}
