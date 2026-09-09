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
        ? "mb-3 grid min-w-0 gap-2 rounded-2xl border border-border/70 bg-muted/30 p-3 text-xs"
        : "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-xs md:px-5"}>
        <label htmlFor={selectId} className="text-muted-foreground">Business</label>
        <select id={selectId} value={activeId} disabled={pending} className={drawer
            ? "min-h-11 w-full min-w-0 rounded-xl border bg-background px-3 py-2 text-base"
            : "min-w-0 max-w-[60vw] flex-1 rounded-md border bg-background px-2 py-1.5 md:max-w-72"} onChange={(event) => {
            const id = event.target.value
            startTransition(async () => {
                try { await switchBusiness(id); router.push("/dashboard"); router.refresh(); onNavigate?.() }
                catch (error) { toast.error(error instanceof Error ? error.message : "Could not switch businesses.") }
            })
        }}>
            {businesses.map((business) => <option key={business.id} value={business.id}>{business.name} · {business.role.toLowerCase()}</option>)}
        </select>
        <Link href="/dashboard/team" onNavigate={onNavigate} className={drawer
            ? "inline-flex min-h-9 items-center justify-self-start underline-offset-4 hover:underline"
            : "ml-auto whitespace-nowrap underline-offset-4 hover:underline"}>Businesses &amp; team</Link>
    </div>
}
