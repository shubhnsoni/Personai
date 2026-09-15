"use client"

import { useState } from "react"
import Link from "@/components/navigation/transition-link"
import { usePathname, useRouter } from "next/navigation"
import { ExternalLink, Menu } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { StudioSignOut } from "@/components/dashboard/studio-sign-out"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
    isWorkspaceActivePath,
    workspaceNavItems,
    workspacePageTitle,
} from "./workspace-nav"

function WorkspaceNav({ onLinkClick }: { onLinkClick?: () => void }) {
    const pathname = usePathname()

    return (
        <div className="flex-1 overflow-auto py-3">
            <nav className="flex flex-col gap-0.5 px-2" aria-label="Workspace">
                {workspaceNavItems.map((item) => {
                    const active = isWorkspaceActivePath(pathname, item)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onLinkClick}
                            aria-current={active ? "page" : undefined}
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
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}

function WorkspaceSidebar({ name, slug }: { name: string; slug: string }) {
    return (
        <div className="hidden h-full w-60 flex-col border-r border-white/8 bg-sidebar text-sidebar-foreground dark:bg-[#050607] md:flex">
            <div className="flex h-16 flex-col justify-center px-4">
                <Logo href="/workspace" size="sm" />
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Workspace
                </span>
            </div>
            <WorkspaceNav />
            <div className="flex items-center gap-2 border-t border-white/8 p-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name || "Workspace"}</p>
                    {slug ? <p className="truncate text-[11px] text-muted-foreground">/{slug}</p> : null}
                </div>
                <StudioSignOut compact />
            </div>
        </div>
    )
}

function WorkspaceMobileNav({
    open,
    onOpenChange,
    name,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    name: string
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
                        <SheetTitle className="sr-only">Workspace menu</SheetTitle>
                        <Logo href="/workspace" size="sm" />
                    </div>
                </SheetHeader>
                <div className="min-h-0 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="grid grid-cols-2 gap-2.5">
                        {workspaceNavItems.map((item) => {
                            const active = isWorkspaceActivePath(pathname, item)
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
                                    <div
                                        className={cn(
                                            "flex h-9 w-9 items-center justify-center rounded-xl",
                                            active ? "bg-aurora/20 text-aurora" : "bg-muted text-muted-foreground",
                                        )}
                                    >
                                        <item.icon className="h-4 w-4" />
                                    </div>
                                    <p className="text-sm font-medium">{item.name}</p>
                                </button>
                            )
                        })}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-border/60 px-1 py-3">
                        <Link href="/dashboard" onClick={() => onOpenChange(false)} className="text-xs text-muted-foreground hover:text-foreground">Studio</Link>
                        <p className="truncate text-xs text-muted-foreground">{name}</p>
                        <StudioSignOut className="h-8 w-auto px-2 text-xs" />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

export function WorkspaceShell({
    children,
    name,
    slug,
}: {
    children: React.ReactNode
    name: string
    slug: string
}) {
    const pathname = usePathname()
    const title = workspacePageTitle(pathname)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const publicHref = `/${slug}`

    return (
        <div className="studio-shell flex h-dvh overflow-hidden">
            <WorkspaceSidebar name={name} slug={slug} />
            <WorkspaceMobileNav
                open={mobileMenuOpen}
                onOpenChange={setMobileMenuOpen}
                name={name}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/8 bg-background/70 px-3 backdrop-blur-md md:h-14 md:px-5 lg:px-8">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 md:hidden"
                        onClick={() => setMobileMenuOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu className="h-4 w-4" />
                    </Button>
                    <h1 className={`min-w-0 flex-1 truncate text-[15px] font-medium tracking-tight${pathname === "/workspace" ? " md:hidden" : ""}`}>
                        {title}
                    </h1>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <Link
                            href="/dashboard"
                            className="inline-flex h-8 items-center rounded-full border border-white/10 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                            Studio
                        </Link>
                        <Link
                            href={publicHref}
                            className="hidden h-8 items-center rounded-full border border-white/10 px-2.5 text-xs text-muted-foreground hover:text-foreground lg:inline-flex"
                        >
                            /{slug}
                        </Link>
                        <Link
                            href={publicHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1 rounded-full bg-[#00D7FF] px-3 text-xs font-medium text-[#061018] hover:bg-[#5ee7ff]"
                        >
                            Live
                            <ExternalLink className="h-3 w-3" />
                        </Link>
                        <ModeToggle />
                        <StudioSignOut compact className="md:hidden" />
                    </div>
                </header>
                <main className="min-h-0 flex-1 overflow-auto px-3 pt-4 pb-6 md:px-6 md:pt-6 md:pb-8 lg:px-8 lg:py-7">
                    <div className="mx-auto w-full max-w-7xl">{children}</div>
                </main>
            </div>
        </div>
    )
}
