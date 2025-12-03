"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    User,
    FileText,
    Briefcase,
    Calendar,
    Users,
    MessageSquare,
    CreditCard,
    ExternalLink,
    Package,
    GraduationCap,
    CalendarDays,
    UsersRound,
    Gift,
    Link2,
    ShoppingBag,
} from "lucide-react"

export const sidebarItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Profile", href: "/dashboard/profile", icon: User },
    { name: "Content", href: "/dashboard/content", icon: FileText },
    { name: "Services", href: "/dashboard/services", icon: Briefcase },
    { name: "Products", href: "/dashboard/products", icon: Package },
    { name: "Courses", href: "/dashboard/courses", icon: GraduationCap },
    { name: "Events", href: "/dashboard/events", icon: CalendarDays },
    { name: "Community", href: "/dashboard/community", icon: UsersRound },
    { name: "Lead Magnets", href: "/dashboard/lead-magnets", icon: Gift },
    { name: "Short Links", href: "/dashboard/links", icon: Link2 },
    { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
    { name: "Leads", href: "/dashboard/leads", icon: Users },
    { name: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
    { name: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
    { name: "Payments", href: "/dashboard/payments", icon: CreditCard },
]

interface SidebarNavProps {
    slug: string
    onLinkClick?: () => void
}

export function SidebarNav({ slug, onLinkClick }: SidebarNavProps) {
    const pathname = usePathname()

    return (
        <>
            <div className="flex-1 overflow-auto py-4">
                <nav className="grid gap-1 px-2">
                    {sidebarItems.map((item, index) => {
                        const isActive = pathname === item.href || 
                            (item.href !== "/dashboard" && pathname.startsWith(item.href))
                        return (
                            <Link
                                key={index}
                                href={item.href}
                                onClick={onLinkClick}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.name}
                            </Link>
                        )
                    })}
                </nav>
            </div>
            <div className="p-4 border-t">
                <Link 
                    href={`/${slug}`} 
                    target="_blank" 
                    onClick={onLinkClick}
                    className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                    <span>View Public Page</span>
                    <ExternalLink className="h-4 w-4" />
                </Link>
            </div>
        </>
    )
}

export function Sidebar({ slug }: { slug: string }) {
    return (
        <div className="hidden md:flex h-full w-64 flex-col border-r bg-card text-card-foreground">
            <div className="flex h-14 items-center border-b px-4">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <span className="text-xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                        PersonaLink
                    </span>
                </Link>
            </div>
            <SidebarNav slug={slug} />
        </div>
    )
}
