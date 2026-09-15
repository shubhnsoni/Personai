import {
    Compass,
    ListTodo,
    MoreHorizontal,
    Plus,
    Sparkles,
    UserRound,
    Wallet,
    type LucideIcon,
} from "lucide-react"

export type WorkspaceNavItem = {
    name: string
    href: string
    icon: LucideIcon
    end?: boolean
    prefixes?: string[]
}

export const workspaceNavItems: WorkspaceNavItem[] = [
    { name: "My AIs", href: "/workspace", icon: Sparkles, end: true },
    { name: "Create", href: "/workspace/create", icon: Plus },
    {
        name: "Jobs",
        href: "/workspace/jobs",
        icon: ListTodo,
        prefixes: ["/workspace/jobs", "/workspace/result"],
    },
    { name: "Profile", href: "/workspace/profile", icon: UserRound },
    { name: "Explore", href: "/workspace/explore", icon: Compass },
    { name: "Earnings", href: "/workspace/earnings", icon: Wallet },
    {
        name: "More",
        href: "/workspace/more",
        icon: MoreHorizontal,
        prefixes: [
            "/workspace/more",
            "/workspace/connections",
            "/workspace/automations",
            "/workspace/teams",
            "/workspace/skills",
            "/workspace/bridge",
            "/workspace/assistant",
            "/workspace/analytics",
            "/workspace/trust",
            "/workspace/reputation",
            "/workspace/checkout",
            "/workspace/hire",
            "/workspace/agents",
            "/workspace/agent",
        ],
    },
]

export function isWorkspaceActivePath(pathname: string, item: WorkspaceNavItem) {
    if (item.end || item.href === "/workspace") return pathname === "/workspace"
    const prefixes = item.prefixes || [item.href]
    return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function workspacePageTitle(pathname: string) {
    if (pathname.startsWith("/workspace/ai/")) return "AI"
    const match = workspaceNavItems.find((item) => isWorkspaceActivePath(pathname, item))
    return match?.name ?? "Workspace"
}
