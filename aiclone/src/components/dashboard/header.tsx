"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ExternalLink, Menu } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { visibleNavItems } from "@/components/dashboard/sidebar"
import { StudioSignOut } from "@/components/dashboard/studio-sign-out"

interface HeaderProps {
    slug: string
    role?: string | null
    extras?: import("@/lib/surfaces").SurfaceExtras | null
    onMenuClick?: () => void
}

function titleFor(pathname: string, role?: string | null, extras?: import("@/lib/surfaces").SurfaceExtras | null) {
    if (pathname === "/dashboard") return "Home"
    const match = visibleNavItems(role, extras).find((item) => {
        if (item.href === "/dashboard") return false
        const prefixes = item.prefixes || [item.href]
        return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    })
    return match?.name ?? "Studio"
}

export function Header({ slug, role, extras, onMenuClick }: HeaderProps) {
    const pathname = usePathname()
    const title = titleFor(pathname, role, extras)
    const home = pathname === "/dashboard"

    return (
        <header className="flex h-12 items-center gap-2 border-b border-white/8 bg-background/70 px-3 backdrop-blur-md md:h-14 md:px-5 lg:px-8">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 md:hidden"
                onClick={onMenuClick}
                aria-label="Open menu"
            >
                <Menu className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
                <h1 className={`truncate text-[15px] font-medium tracking-tight ${home ? "md:hidden" : ""}`}>
                    {title}
                </h1>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
                <Link
                    href={`/${slug}`}
                    className="hidden h-8 items-center rounded-full border border-white/10 px-2.5 text-xs text-muted-foreground hover:text-foreground lg:inline-flex"
                >
                    /{slug}
                </Link>
                <Link
                    href={`/${slug}`}
                    target="_blank"
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-[#00D7FF] px-3 text-xs font-medium text-[#061018] hover:bg-[#5ee7ff]"
                >
                    Live
                    <ExternalLink className="h-3 w-3" />
                </Link>
                <ModeToggle />
                <StudioSignOut compact className="md:hidden" />
            </div>
        </header>
    )
}
