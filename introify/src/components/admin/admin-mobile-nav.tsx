"use client"

import { usePathname, useRouter } from "next/navigation"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Logo } from "@/components/brand/logo"
import { StudioSignOut } from "@/components/dashboard/studio-sign-out"
import { cn } from "@/lib/utils"
import { adminNavItems, isAdminActivePath } from "@/components/admin/admin-nav"

export function AdminMobileNav({
    open,
    onOpenChange,
    email,
    supportCount = 0,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    email?: string | null
    supportCount?: number
}) {
    const pathname = usePathname()
    const router = useRouter()

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="z-[60] gap-0 p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                <SheetHeader className="relative shrink-0 space-y-0 p-0 pr-12">
                    <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/30" />
                    <div className="flex h-12 items-center px-4 pr-12">
                        <SheetTitle className="sr-only">Platform menu</SheetTitle>
                        <Logo href="/admin" size="sm" />
                    </div>
                </SheetHeader>
                <div className="min-h-0 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="grid grid-cols-2 gap-2.5">
                        {adminNavItems.map((item) => {
                            const active = isAdminActivePath(pathname, item)
                            const count = item.countKey === "support" ? supportCount : 0
                            return (
                                <button
                                    key={item.href}
                                    type="button"
                                    onClick={() => {
                                        if (pathname !== item.href) router.push(item.href)
                                        onOpenChange(false)
                                    }}
                                    className={cn(
                                        "flex min-h-[5.25rem] flex-col justify-between rounded-2xl border p-3 text-left touch-manipulation",
                                        active ? "border-aurora/40 bg-aurora/10" : "border-border/70 bg-card",
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div
                                            className={cn(
                                                "flex h-9 w-9 items-center justify-center rounded-xl",
                                                active ? "bg-aurora/20 text-aurora" : "bg-muted text-muted-foreground",
                                            )}
                                        >
                                            <item.icon className="h-4 w-4" />
                                        </div>
                                        {count > 0 ? (
                                            <p className="text-xl font-semibold leading-none tabular-nums text-aurora">{count}</p>
                                        ) : null}
                                    </div>
                                    <p className="text-sm font-medium">{item.name}</p>
                                </button>
                            )
                        })}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-border/60 px-1 py-3">
                        <p className="truncate text-xs text-muted-foreground">{email}</p>
                        <StudioSignOut className="h-8 w-auto px-2 text-xs" />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
