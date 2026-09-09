"use client"

import Link from "@/components/navigation/transition-link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/brand/logo"
import { StudioSignOut } from "@/components/dashboard/studio-sign-out"
import { cn } from "@/lib/utils"
import { adminNavGroups, isAdminActivePath } from "@/components/admin/admin-nav"

export function AdminSidebar({
    email,
    supportCount = 0,
}: {
    email?: string | null
    supportCount?: number
}) {
    const pathname = usePathname()

    return (
        <div className="hidden h-full w-60 flex-col border-r border-white/8 bg-sidebar text-sidebar-foreground dark:bg-[#050607] md:flex">
            <div className="flex h-16 flex-col justify-center px-4">
                <Logo href="/admin" size="sm" />
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Platform</span>
            </div>
            <div className="flex-1 overflow-auto py-3">
                <nav className="flex flex-col gap-4 px-2">
                    {adminNavGroups.map((group) => (
                        <div key={group.label ?? "command"} className="flex flex-col gap-0.5">
                            {group.label ? (
                                <p className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
                                    {group.label}
                                </p>
                            ) : null}
                            {group.items.map((item) => {
                                const active = isAdminActivePath(pathname, item)
                                const count = item.countKey === "support" ? supportCount : 0
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
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
                                        {count > 0 ? (
                                            <span className="rounded-full bg-white/6 px-1.5 py-0.5 text-[10px] tabular-nums text-[#00D7FF]">
                                                {count}
                                            </span>
                                        ) : null}
                                    </Link>
                                )
                            })}
                        </div>
                    ))}
                </nav>
            </div>
            <div className="flex items-center gap-2 border-t border-white/8 p-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{email || "Admin"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">Platform owner</p>
                </div>
                <StudioSignOut className="h-8 w-auto shrink-0 px-2 text-xs" />
            </div>
        </div>
    )
}
