"use client"

import { useId, useTransition } from "react"
import Link from "@/components/navigation/transition-link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { switchBusiness } from "@/app/actions/billing-team"

export type BusinessOption = { id: string; name: string; role: string }

interface BusinessSwitcherProps {
    businesses: BusinessOption[]
    activeId: string
    variant?: "bar" | "drawer"
    onNavigate?: () => void
}

export function BusinessSwitcher({ businesses, activeId, variant = "bar", onNavigate }: BusinessSwitcherProps) {
    const [pending, startTransition] = useTransition()
    const selectId = useId()
    const router = useRouter()
    const drawer = variant === "drawer"
    return <div className={drawer
        ? "flex min-w-0 flex-1 items-center"
        : "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-xs md:px-5"}>
        <label htmlFor={selectId} className={drawer ? "sr-only" : "text-muted-foreground"}>Business</label>
        <select id={selectId} value={activeId} disabled={pending} className={drawer
            ? "h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
            : "min-w-0 max-w-[60vw] flex-1 rounded-md border bg-background px-2 py-1.5 md:max-w-72"} onChange={(event) => {
            const id = event.target.value
            startTransition(async () => {
                try { await switchBusiness(id); router.push("/dashboard"); router.refresh(); onNavigate?.() }
                catch (error) { toast.error(error instanceof Error ? error.message : "Could not switch businesses.") }
            })
        }}>
            {businesses.map((business) => <option key={business.id} value={business.id}>{business.name} · {business.role.toLowerCase()}</option>)}
        </select>
        {drawer ? null : <Link href="/dashboard/team" onNavigate={onNavigate} className="ml-auto whitespace-nowrap underline-offset-4 hover:underline">Businesses &amp; team</Link>}
    </div>
}
