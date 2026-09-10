"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "@/components/navigation/transition-link"
import { usePathname, useRouter } from "next/navigation"
import { BusinessSwitcher, type BusinessOption } from "@/components/dashboard/business-switcher"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar"
import { LiveRequestPopup } from "@/components/dashboard/live-request-popup"
import { ExitImpersonateButton } from "@/components/admin/admin-actions"
import { cn } from "@/lib/utils"
import type { NavCounts } from "@/lib/nav-counts"
import { fieldOn, hasSurface, surfaceForPath } from "@/lib/surfaces"

interface DashboardLayoutClientProps {
    children: ReactNode
    businesses?: BusinessOption[]
    activeProfileId?: string
    slug: string
    liveHref?: string
    name?: string
    counts?: NavCounts
    role?: string | null
    extras?: import("@/lib/surfaces").SurfaceExtras | null
    impersonating?: boolean
    isAdmin?: boolean
}

export function DashboardLayoutClient({ children, slug, liveHref, name, counts, role, extras, impersonating, isAdmin, businesses, activeProfileId }: DashboardLayoutClientProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const surface = surfaceForPath(pathname)
    const blocked = Boolean(surface && role && !hasSurface(role, surface, extras))
        || Boolean(role && pathname.startsWith("/dashboard/lead-magnets") && !fieldOn(role, "shopDigital", extras))

    useEffect(() => {
        if (blocked) router.replace("/dashboard")
    }, [blocked, router])

    const fill = pathname === "/dashboard/inbox" || pathname === "/dashboard/calendar" || pathname === "/dashboard/profile"
    const flush = pathname === "/dashboard/inbox" || pathname === "/dashboard/profile"

    return (
        <div className="studio-shell flex h-dvh overflow-hidden">
            <Sidebar counts={counts} role={role} extras={extras} name={name} slug={slug} />
            <MobileSidebar
                open={mobileMenuOpen}
                onOpenChange={setMobileMenuOpen}
                counts={counts}
                role={role}
                extras={extras}
                businesses={businesses}
                activeProfileId={activeProfileId}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {impersonating ? (
                    <div className="flex shrink-0 items-center justify-center gap-2 bg-amber-400 px-3 py-1.5 text-[11px] font-medium text-zinc-950">
                        Viewing {name} as support
                        <ExitImpersonateButton />
                    </div>
                ) : isAdmin || slug.startsWith("try-") ? (
                    <div className="flex shrink-0 items-center justify-center gap-3 bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                        {isAdmin ? (
                            <Link href="/admin" className="hover:text-foreground">
                                Console
                            </Link>
                        ) : null}
                        {slug.startsWith("try-") ? (
                            <Link href="/admin/kits" className="hover:text-foreground">
                                Trying {role || "kit"} · all kits
                            </Link>
                        ) : (
                            <span>Platform admin</span>
                        )}
                    </div>
                ) : null}
                {businesses && activeProfileId && (
                    <div className="hidden shrink-0 md:block">
                        <BusinessSwitcher businesses={businesses} activeId={activeProfileId} />
                    </div>
                )}
                <Header slug={slug} liveHref={liveHref} role={role} extras={extras} onMenuClick={() => setMobileMenuOpen(true)} flushBottom={pathname === "/dashboard/profile"} />
                <main
                    className={cn(
                        "min-h-0 flex-1",
                        fill ? "flex flex-col overflow-hidden" : "overflow-auto",
                        flush ? "p-0" : "px-3 pt-4 pb-6 md:px-6 md:pt-6 md:pb-8 lg:px-8 lg:py-7",
                    )}
                >
                    {blocked ? null : fill ? children : (
                        <div className="mx-auto w-full max-w-7xl">{children}</div>
                    )}
                </main>
            </div>
            <LiveRequestPopup />
        </div>
    )
}
