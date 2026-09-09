"use client"

import { useState, type ReactNode } from "react"
import Link from "@/components/navigation/transition-link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav"
import { adminPageTitle } from "@/components/admin/admin-nav"

export function AdminShell({
    children,
    email,
    supportCount = 0,
}: {
    children: ReactNode
    email?: string | null
    supportCount?: number
}) {
    const pathname = usePathname()
    const title = adminPageTitle(pathname)
    const [menuOpen, setMenuOpen] = useState(false)

    return (
        <div className="studio-shell flex h-dvh overflow-hidden">
            <AdminSidebar email={email} supportCount={supportCount} />
            <AdminMobileNav
                open={menuOpen}
                onOpenChange={setMenuOpen}
                email={email}
                supportCount={supportCount}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/8 bg-background/70 px-3 backdrop-blur-md md:h-14 md:px-5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 md:hidden"
                        onClick={() => setMenuOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu className="h-4 w-4" />
                    </Button>
                    <h1 className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-tight">{title}</h1>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <Link
                            href="/dashboard"
                            className="inline-flex h-8 items-center rounded-full border border-white/10 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                            Studio
                        </Link>
                        <ModeToggle />
                    </div>
                </header>
                <main className="min-h-0 flex-1 overflow-auto px-3 pt-4 pb-6 md:px-6 md:pt-6 md:pb-8 lg:px-8 lg:py-7">
                    <div className="mx-auto w-full max-w-6xl">{children}</div>
                </main>
            </div>
        </div>
    )
}
