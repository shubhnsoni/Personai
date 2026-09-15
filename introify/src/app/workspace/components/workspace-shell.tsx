"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sparkles, Plus, ListTodo, UserRound, ExternalLink } from "lucide-react"

const tabs = [
    { href: "/workspace", label: "My AIs", icon: Sparkles, end: true },
    { href: "/workspace/create", label: "Create", icon: Plus },
    { href: "/workspace/jobs", label: "Jobs", icon: ListTodo },
    { href: "/workspace/profile", label: "Profile", icon: UserRound },
]

function NavLink({ href, label, icon: Icon, end }: { href: string; label: string; icon: typeof Sparkles; end?: boolean }) {
    const pathname = usePathname()
    const active = end ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
    return (
        <Link
            href={href}
            className={`w-navlink${active ? " on" : ""}`}
            aria-current={active ? "page" : undefined}
        >
            <Icon size={16} strokeWidth={active ? 2 : 1.5} aria-hidden="true" />
            {label}
        </Link>
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
    const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    return (
        <div className="w-app">
            <header className="w-topbar">
                <Link href="/workspace" className="w-brand" aria-label="My AIs">
                    <span className="w-brand-mark" aria-hidden="true">i</span>
                    <span>Workspace</span>
                </Link>
                <nav className="w-nav" aria-label="Workspace">
                    {tabs.map((tab) => (
                        <NavLink key={tab.href} {...tab} />
                    ))}
                </nav>
                <div className="w-top-actions">
                    <Link href={`/${slug}`} className="w-ghost" target="_blank" rel="noreferrer">
                        Public page <ExternalLink size={14} aria-hidden="true" />
                    </Link>
                    <Link href="/workspace/profile" className="w-avatar" aria-label="Profile showcase">
                        {initials || "AI"}
                    </Link>
                </div>
            </header>
            <div className="w-body">{children}</div>
            <nav className="w-bottom-nav" aria-label="Workspace mobile">
                {tabs.map((tab) => (
                    <NavLink key={tab.href} {...tab} />
                ))}
            </nav>
        </div>
    )
}
