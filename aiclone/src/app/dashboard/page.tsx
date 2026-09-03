import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { ExternalLink, MessageSquare } from "lucide-react"
import Link from "next/link"
import { ShareSheet } from "@/components/dashboard/share-sheet"
import { HomePulse } from "@/components/dashboard/home-pulse"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { extrasOf, hasSurface } from "@/lib/surfaces"
import { buildHomeStats } from "@/lib/analytics"
import { StudioPageHead, StudioPanel, StudioRow } from "@/components/dashboard/studio-ui"
import { isJewelryKit } from "@/lib/metal/math"
import { goldBoardFromConfig } from "@/lib/metal/board"
import { GoldBoardCard } from "@/components/shop/gold-board-card"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const extras = extrasOf(profile)
    const stats = await buildHomeStats(profile)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    const [liveRequests, recentConversations, recentLeads] = await Promise.all([
        prisma.conversation.findMany({
            where: { profileId: profile.id, mode: "LIVE_REQUESTED" },
            orderBy: { liveRequestedAt: "asc" },
            take: 5,
            select: { id: true, visitorName: true, visitorEmail: true },
        }).catch(() => [] as { id: string; visitorName: string | null; visitorEmail: string | null }[]),
        prisma.conversation.findMany({
            where: { profileId: profile.id },
            orderBy: { lastMessageAt: "desc" },
            take: 5,
            include: { messages: { take: 1, orderBy: { createdAt: "desc" } } },
        }),
        hasSurface(profile.roleTemplate, "leads", extras)
            ? prisma.visitorLead.findMany({
                where: { profileId: profile.id },
                orderBy: { createdAt: "desc" },
                take: 5,
            })
            : Promise.resolve([]),
    ])

    const feed = [
        ...recentConversations.map((c) => ({
            id: c.id,
            href: "/dashboard/inbox",
            name: c.visitorName || "Visitor",
            detail: c.messages[0]?.text || "Chat",
            at: c.lastMessageAt,
            kind: "chat" as const,
        })),
        ...recentLeads.map((l) => ({
            id: l.id,
            href: "/dashboard/inbox",
            name: l.name,
            detail: l.email,
            at: l.createdAt,
            kind: "lead" as const,
        })),
    ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 8)

    return (
        <div className="space-y-4 lg:space-y-5">
            {liveRequests.length > 0 && (
                <StudioPanel className="border-cyan-400/30 bg-cyan-400/8">
                    {liveRequests.map((req) => (
                        <Link
                            key={req.id}
                            href={`/dashboard/inbox?c=${req.id}`}
                            className="flex items-center justify-between gap-2 border-b border-cyan-400/15 px-4 py-3 last:border-b-0"
                        >
                            <p className="truncate text-sm font-medium">
                                {req.visitorName || req.visitorEmail || "A visitor"} wants to talk live
                            </p>
                            <span className="shrink-0 text-xs text-[#00D7FF]">Open</span>
                        </Link>
                    ))}
                </StudioPanel>
            )}

            <StudioPageHead
                kicker="Studio"
                title={profile.displayName}
                hint={nextAction(stats)}
                action={<ShareSheet slug={profile.slug} name={profile.displayName} baseUrl={baseUrl} />}
            />

            {isJewelryKit(profile.roleTemplate) ? (
                <GoldBoardCard
                    profileId={profile.id}
                    board={goldBoardFromConfig(profile.personalityConfig)}
                    personalityConfig={profile.personalityConfig}
                />
            ) : null}

            <HomePulse stats={stats} slug={profile.slug} />

            <div className="grid gap-3 lg:grid-cols-12">
                <StudioPanel className="lg:col-span-7">
                    <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Live</p>
                        <div className="flex gap-3 text-[11px] text-muted-foreground">
                            <Link href="/dashboard/inbox" className="hover:text-foreground">Chats</Link>
                            {hasSurface(profile.roleTemplate, "leads", extras) ? (
                                <Link href="/dashboard/leads" className="hover:text-foreground">Leads</Link>
                            ) : null}
                            {hasSurface(profile.roleTemplate, "sales", extras) ? (
                                <Link href="/dashboard/money" className="hover:text-foreground">Sales</Link>
                            ) : null}
                        </div>
                    </div>
                    {feed.length === 0 ? (
                        <EmptyState
                            icon={<MessageSquare />}
                            title="Nothing live yet"
                            description="Share your page. Visits and chats land here."
                            action={
                                <Button variant="pill" size="sm" asChild>
                                    <Link href={`/${profile.slug}`}>Open live page</Link>
                                </Button>
                            }
                        />
                    ) : (
                        feed.map((item) => (
                            <StudioRow key={`${item.kind}-${item.id}`} href={item.href}>
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.kind === "lead" ? "bg-emerald-400" : "bg-[#00D7FF]"}`} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline gap-2">
                                        <span className="truncate text-sm font-medium">{item.name}</span>
                                        <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelativeTime(item.at)}</span>
                                    </div>
                                    <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                                </div>
                            </StudioRow>
                        ))
                    )}
                </StudioPanel>

                <StudioPanel className="hidden p-5 lg:col-span-5 lg:block">
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-300/80">Live page</p>
                    <p className="mt-3 text-lg font-semibold tracking-tight">/{profile.slug}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Share this. Visitors chat, book, and buy here.</p>
                    <Button asChild variant="pill" className="mt-5 h-9">
                        <Link href={`/${profile.slug}`} target="_blank">
                            Open page <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                    </Button>
                </StudioPanel>
            </div>
        </div>
    )
}

function nextAction(s: Awaited<ReturnType<typeof buildHomeStats>>) {
    if (s.unanswered > 0) return `${s.unanswered} chat${s.unanswered === 1 ? "" : "s"} waiting on you.`
    if ((s.leads7 || 0) > 0) return `${s.leads7} new lead${s.leads7 === 1 ? "" : "s"} this week. Open Inbox.`
    if ((s.upcoming || 0) > 0) return `${s.upcoming} upcoming. Check Calendar.`
    if (s.visits > 0 && s.chats === 0) return "People opened the page. Share the chat chip."
    if (s.chats30 > 0) return `${s.chats30} chats in 30 days. Share the page again.`
    return "Share your page. Visits land here."
}

function formatRelativeTime(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - new Date(date).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return new Date(date).toLocaleDateString()
}
