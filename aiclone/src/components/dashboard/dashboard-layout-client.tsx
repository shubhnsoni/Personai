"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar"
import { cn } from "@/lib/utils"
import type { NavCounts } from "@/lib/nav-counts"
import { fieldOn, hasSurface, surfaceForPath } from "@/lib/surfaces"

interface DashboardLayoutClientProps {
    children: React.ReactNode
    slug: string
    counts?: NavCounts
    role?: string | null
    extras?: import("@/lib/surfaces").SurfaceExtras | null
}

export function DashboardLayoutClient({ children, slug, counts, role, extras }: DashboardLayoutClientProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const surface = surfaceForPath(pathname)
    const blocked = Boolean(surface && role && !hasSurface(role, surface, extras))
        || Boolean(role && pathname.startsWith("/dashboard/lead-magnets") && !fieldOn(role, "shopDigital", extras))

    useEffect(() => {
        if (blocked) router.replace("/dashboard")
    }, [blocked, router])

    const fill = pathname === "/dashboard/inbox" || pathname === "/dashboard/calendar"
    const flush = pathname === "/dashboard/inbox"

    return (
        <div className="flex h-dvh overflow-hidden bg-background">
            <Sidebar counts={counts} role={role} extras={extras} />
            <MobileSidebar
                open={mobileMenuOpen}
                onOpenChange={setMobileMenuOpen}
                counts={counts}
                role={role}
                extras={extras}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {slug.startsWith("try-") ? (
                    <a
                        href="/qa"
                        className="shrink-0 bg-aurora/15 px-3 py-1.5 text-center text-[11px] font-medium text-aurora"
                    >
                        Trying {role || "kit"} · back to all kits
                    </a>
                ) : null}
                <Header slug={slug} role={role} extras={extras} onMenuClick={() => setMobileMenuOpen(true)} />
                <main
                    className={cn(
                        "min-h-0 flex-1",
                        fill ? "flex flex-col overflow-hidden" : "overflow-auto",
                        flush ? "p-0" : "px-3 pt-4 pb-6 md:px-5 md:pt-6 md:pb-8"
                    )}
                >
                    {blocked ? null : children}
                </main>
            </div>
        </div>
    )
}
