import Link from "next/link"
import { BRAND } from "@/lib/brand"

const LINKS = [
    { href: "/admin", label: "Today" },
    { href: "/admin/money", label: "Money" },
    { href: "/admin/traffic", label: "Traffic" },
    { href: "/admin/shops", label: "Shops" },
    { href: "/admin/users", label: "People" },
    { href: "/admin/growth", label: "Growth" },
    { href: "/admin/capacity", label: "Capacity" },
    { href: "/admin/ai", label: "AI" },
    { href: "/admin/support", label: "Support" },
    { href: "/admin/audit", label: "Audit" },
    { href: "/qa", label: "Kits" },
]

export function AdminShell({
    children,
    email,
}: {
    children: React.ReactNode
    email?: string | null
}) {
    return (
        <div className="flex min-h-dvh flex-col bg-background">
            <header className="flex h-14 items-center gap-4 border-b px-4 md:px-6">
                <Link href="/admin" className="font-semibold tracking-tight">{BRAND.name}</Link>
                <nav className="flex min-w-0 flex-1 gap-3 overflow-x-auto text-sm">
                    {LINKS.map((link) => (
                        <Link key={link.href} href={link.href} className="shrink-0 text-muted-foreground hover:text-foreground">
                            {link.label}
                        </Link>
                    ))}
                </nav>
                <span className="hidden truncate text-xs text-muted-foreground sm:block">{email}</span>
                <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">Studio</Link>
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6">{children}</main>
        </div>
    )
}
