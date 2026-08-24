"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/brand/logo"
import { StudioSignOut } from "@/components/dashboard/studio-sign-out"
import { cn } from "@/lib/utils"
import { countForHref, type NavCounts } from "@/lib/nav-counts"
import { hasSurface, navHrefToSurface, shopNavLabel } from "@/lib/surfaces"
import {
    LayoutDashboard,
    User,
    Calendar,
    MessageSquare,
    Package,
    ShoppingBag,
    GraduationCap,
    Briefcase,
    Ticket,
    UserPlus,
} from "lucide-react"

export type NavItem = { name: string; href: string; icon: typeof LayoutDashboard; prefixes?: string[] }

export const navGroups: { label: string | null; items: NavItem[] }[] = [
    {
        label: null,
        items: [
            { name: "Home", href: "/dashboard", icon: LayoutDashboard },
            {
                name: "Profile",
                href: "/dashboard/profile",
                icon: User,
                prefixes: ["/dashboard/profile", "/dashboard/content", "/dashboard/import", "/dashboard/links"],
            },
            {
                name: "Chats",
                href: "/dashboard/inbox",
                icon: MessageSquare,
                prefixes: ["/dashboard/inbox", "/dashboard/conversations"],
            },
            { name: "Leads", href: "/dashboard/leads", icon: UserPlus },
            { name: "Courses", href: "/dashboard/courses", icon: GraduationCap },
            {
                name: "Shop",
                href: "/dashboard/products",
                icon: Package,
                prefixes: ["/dashboard/products", "/dashboard/lead-magnets", "/dashboard/offer"],
            },
            { name: "Services", href: "/dashboard/services", icon: Briefcase },
            {
                name: "Events",
                href: "/dashboard/events",
                icon: Ticket,
                prefixes: ["/dashboard/events", "/dashboard/community"],
            },
            { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
            {
                name: "Sales",
                href: "/dashboard/money",
                icon: ShoppingBag,
                prefixes: ["/dashboard/money", "/dashboard/orders", "/dashboard/payments"],
            },
        ],
    },
]

export const sidebarItems = navGroups.flatMap((g) => g.items)

export function visibleNavItems(role?: string | null, extras?: import("@/lib/surfaces").SurfaceExtras | null): NavItem[] {
    return sidebarItems
        .filter((item) => {
            const surface = navHrefToSurface(item.href)
            return !surface || hasSurface(role, surface, extras)
        })
        .map((item) => (
            item.href === "/dashboard/products"
                ? { ...item, name: shopNavLabel(role) }
                : item
        ))
}

export function isActivePath(pathname: string, item: NavItem) {
    if (item.href === "/dashboard") return pathname === "/dashboard"
    const prefixes = item.prefixes || [item.href]
    return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

interface SidebarNavProps {
    counts?: NavCounts
    onLinkClick?: () => void
    role?: string | null
    extras?: import("@/lib/surfaces").SurfaceExtras | null
}

export function SidebarNav({ counts, onLinkClick, role, extras }: SidebarNavProps) {
    const pathname = usePathname()
    const items = visibleNavItems(role, extras)

    return (
        <>
            <div className="flex-1 overflow-auto py-3">
                <nav className="flex flex-col gap-0.5 px-2">
                    {items.map((item) => {
                        const active = isActivePath(pathname, item)
                        const stat = counts ? countForHref(counts, item.href) : null
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onLinkClick}
                                className={cn(
                                    "flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                                    active
                                        ? "bg-aurora/10 text-foreground ring-1 ring-aurora/25"
                                        : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                                )}
                            >
                                <item.icon className={cn("h-3.5 w-3.5", active && "text-aurora")} />
                                <span className="flex-1 truncate">{item.name}</span>
                                {stat && stat.value > 0 && (
                                    <span className="text-[10px] tabular-nums text-muted-foreground">
                                        {stat.value}
                                        {stat.fresh ? (
                                            <span className="ml-1 text-aurora">+{stat.fresh}</span>
                                        ) : null}
                                    </span>
                                )}
                            </Link>
                        )
                    })}
                </nav>
            </div>
        </>
    )
}

export function Sidebar({ counts, role, extras }: { counts?: NavCounts; role?: string | null; extras?: import("@/lib/surfaces").SurfaceExtras | null }) {
    return (
        <div className="hidden md:flex h-full w-56 flex-col border-r border-border/60 bg-sidebar text-sidebar-foreground">
            <div className="flex h-12 items-center px-4">
                <Logo />
            </div>
            <SidebarNav counts={counts} role={role} extras={extras} />
            <div className="border-t border-border/60 p-2">
                <StudioSignOut />
            </div>
        </div>
    )
}
