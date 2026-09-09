import {
    Activity,
    Boxes,
    Gauge,
    LayoutDashboard,
    MessageSquare,
    ScrollText,
    Sparkles,
    Store,
    Users,
    Wallet,
    type LucideIcon,
} from "lucide-react"

export type AdminNavItem = {
    name: string
    href: string
    icon: LucideIcon
    prefixes?: string[]
    countKey?: "support"
}

export type AdminNavGroup = {
    label: string | null
    items: AdminNavItem[]
}

export const adminNavGroups: AdminNavGroup[] = [
    {
        label: null,
        items: [
            { name: "Today", href: "/admin", icon: LayoutDashboard },
            { name: "Support", href: "/admin/support", icon: MessageSquare, countKey: "support" },
        ],
    },
    {
        label: "Observe",
        items: [
            { name: "Money", href: "/admin/money", icon: Wallet },
            { name: "Traffic", href: "/admin/traffic", icon: Activity, prefixes: ["/admin/traffic", "/admin/visitors"] },
        ],
    },
    {
        label: "Tenants",
        items: [
            { name: "Shops", href: "/admin/shops", icon: Store, prefixes: ["/admin/shops"] },
            { name: "People", href: "/admin/users", icon: Users, prefixes: ["/admin/users"] },
        ],
    },
    {
        label: "QA",
        items: [
            { name: "Kits", href: "/admin/kits", icon: Boxes },
        ],
    },
    {
        label: "Platform",
        items: [
            { name: "Billing", href: "/admin/billing", icon: Wallet },
            { name: "AI", href: "/admin/ai", icon: Sparkles },
            { name: "Capacity", href: "/admin/capacity", icon: Gauge },
            { name: "Audit", href: "/admin/audit", icon: ScrollText },
        ],
    },
]

export const adminNavItems = adminNavGroups.flatMap((group) => group.items)

export function isAdminActivePath(pathname: string, item: AdminNavItem) {
    if (item.href === "/admin") return pathname === "/admin"
    const prefixes = item.prefixes || [item.href]
    return prefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export function adminPageTitle(pathname: string) {
    return adminNavItems.find((item) => isAdminActivePath(pathname, item))?.name ?? "Platform"
}
