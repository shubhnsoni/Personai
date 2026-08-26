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
                                "relative flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition-colors",
                                active
                                    ? "bg-cyan-400/8 text-foreground"
                                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                            )}
                        >
                            {active ? (
                                <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-[#00D7FF]" />
                            ) : null}
                            <item.icon className={cn("h-4 w-4", active && "text-[#00D7FF]")} />
                            <span className="flex-1 truncate">{item.name}</span>
                            {stat && stat.value > 0 ? (
                                <span className="rounded-full bg-white/6 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                                    {stat.value}
                                    {stat.fresh ? <span className="ml-1 text-[#00D7FF]">+{stat.fresh}</span> : null}
                                </span>
                            ) : null}
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}

export function Sidebar({
    counts,
    role,
    extras,
    name,
    slug,
}: {
    counts?: NavCounts
    role?: string | null
    extras?: import("@/lib/surfaces").SurfaceExtras | null
    name?: string
    slug?: string
}) {
    return (
        <div className="hidden h-full w-60 flex-col border-r border-white/8 bg-sidebar text-sidebar-foreground dark:bg-[#050607] md:flex">
            <div className="flex h-16 flex-col justify-center px-4">
                <Logo href="/dashboard" size="sm" />
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Studio</span>
            </div>
            <SidebarNav counts={counts} role={role} extras={extras} />
            <div className="flex items-center gap-2 border-t border-white/8 p-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name || "Studio"}</p>
                    {slug ? <p className="truncate text-[11px] text-muted-foreground">/{slug}</p> : null}
                </div>
                <StudioSignOut compact />
            </div>
        </div>
    )
}
