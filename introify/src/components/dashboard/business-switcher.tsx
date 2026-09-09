"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { switchBusiness } from "@/app/actions/billing-team"

export type BusinessOption = { id: string; name: string; role: string }

export function BusinessSwitcher({ businesses, activeId }: { businesses: BusinessOption[]; activeId: string }) {
    const [pending, startTransition] = useTransition()
    const router = useRouter()
    return <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-xs md:px-5">
        <label htmlFor="active-business" className="text-muted-foreground">Business</label>
        <select id="active-business" value={activeId} disabled={pending} className="min-w-0 max-w-[60vw] flex-1 rounded-md border bg-background px-2 py-1.5 md:max-w-72" onChange={(event) => {
            const id = event.target.value
            startTransition(async () => {
                try { await switchBusiness(id); router.push("/dashboard"); router.refresh() }
                catch (error) { toast.error(error instanceof Error ? error.message : "Could not switch businesses.") }
            })
        }}>
            {businesses.map((business) => <option key={business.id} value={business.id}>{business.name} · {business.role.toLowerCase()}</option>)}
        </select>
        <Link href="/dashboard/team" className="ml-auto whitespace-nowrap underline-offset-4 hover:underline">Businesses &amp; team</Link>
    </div>
}
