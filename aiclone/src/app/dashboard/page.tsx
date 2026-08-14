import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { MessageSquare, Users, Calendar, DollarSign, ExternalLink, TrendingUp } from "lucide-react"
import Link from "next/link"
import { ProfileLinkActions } from "@/components/dashboard/profile-link-actions"
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts"

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
        conversationCount,
        conversationCountLast30Days,
        leadCount,
        leadCountLast7Days,
        bookingCount,
        upcomingBookings,
        paymentSum,
        recentConversations,
        recentLeads,
        // Analytics data
        dailyConversations,
        dailyLeads,
        dailyRevenue,
        productPurchaseCount,
        courseEnrollmentCount,
    ] = await Promise.all([
        prisma.conversation.count({ where: { profileId: profile.id } }),
        prisma.conversation.count({ where: { profileId: profile.id, startedAt: { gte: thirtyDaysAgo } } }),
        prisma.visitorLead.count({ where: { profileId: profile.id } }),
        prisma.visitorLead.count({ where: { profileId: profile.id, createdAt: { gte: sevenDaysAgo } } }),
        prisma.booking.count({ where: { profileId: profile.id } }),
        prisma.booking.count({ where: { profileId: profile.id, startTime: { gte: now } } }),
        prisma.payment.aggregate({
            where: { profileId: profile.id, status: "SUCCEEDED" },
            _sum: { amountCents: true }
        }),
        prisma.conversation.findMany({
            where: { profileId: profile.id },
            orderBy: { lastMessageAt: "desc" },
            take: 5,
            include: { messages: { take: 1, orderBy: { createdAt: "desc" } } }
        }),
        prisma.visitorLead.findMany({
            where: { profileId: profile.id },
            orderBy: { createdAt: "desc" },
            take: 5
        }),
        // Daily conversations for last 30 days
        prisma.conversation.findMany({
            where: { profileId: profile.id, startedAt: { gte: thirtyDaysAgo } },
            select: { startedAt: true },
            orderBy: { startedAt: 'asc' }
        }),
        // Daily leads for last 30 days
        prisma.visitorLead.findMany({
            where: { profileId: profile.id, createdAt: { gte: thirtyDaysAgo } },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' }
        }),
        // Daily revenue for last 30 days
        prisma.payment.findMany({
            where: { profileId: profile.id, status: "SUCCEEDED", createdAt: { gte: thirtyDaysAgo } },
            select: { amountCents: true, createdAt: true },
            orderBy: { createdAt: 'asc' }
        }),
        // Total purchases
        prisma.productPurchase.count({
            where: { product: { profileId: profile.id }, status: 'COMPLETED' }
        }),
        // Total enrollments
        prisma.courseEnrollment.count({
            where: { course: { profileId: profile.id }, status: { in: ['ACTIVE', 'COMPLETED'] } }
        }),
    ])

    // Aggregate daily data
    function aggregateByDay(items: { startedAt?: Date; createdAt?: Date }[]): Record<string, number> {
        const result: Record<string, number> = {}
        for (const item of items) {
            const date = (item.startedAt || item.createdAt)!
            const key = new Date(date).toISOString().split('T')[0]
            result[key] = (result[key] || 0) + 1
        }
        return result
    }

    function aggregateRevenueByDay(items: { amountCents: number; createdAt: Date }[]): Record<string, number> {
        const result: Record<string, number> = {}
        for (const item of items) {
            const key = new Date(item.createdAt).toISOString().split('T')[0]
            result[key] = (result[key] || 0) + item.amountCents / 100
        }
        return result
    }

    // Build chart data for last 30 days
    const chartDays: string[] = []
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        chartDays.push(d.toISOString().split('T')[0])
    }

    const convByDay = aggregateByDay(dailyConversations.map(c => ({ startedAt: c.startedAt })))
    const leadsByDay = aggregateByDay(dailyLeads.map(l => ({ createdAt: l.createdAt })))
    const revByDay = aggregateRevenueByDay(dailyRevenue)

    const chartData = chartDays.map(day => ({
        date: day,
        conversations: convByDay[day] || 0,
        leads: leadsByDay[day] || 0,
        revenue: revByDay[day] || 0,
    }))

    // Conversion funnel
    const totalRevenue = (paymentSum._sum.amountCents || 0) / 100
    const totalPurchases = productPurchaseCount + courseEnrollmentCount

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return (
        <div className="space-y-8 p-8 pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Welcome back, {profile.displayName}</h2>
                    <p className="text-muted-foreground mt-1">Here&apos;s what&apos;s happening with your profile</p>
                </div>
                <ProfileLinkActions slug={profile.slug} baseUrl={baseUrl} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Conversations"
                    value={conversationCount}
                    subtitle={`${conversationCountLast30Days} in last 30 days`}
                    icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
                    href="/dashboard/conversations"
                />
                <StatCard
                    title="Leads"
                    value={leadCount}
                    subtitle={`${leadCountLast7Days} new this week`}
                    icon={<Users className="h-4 w-4 text-muted-foreground" />}
                    href="/dashboard/leads"
                    highlight={leadCountLast7Days > 0}
                />
                <StatCard
                    title="Bookings"
                    value={bookingCount}
                    subtitle={`${upcomingBookings} upcoming`}
                    icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
                    href="/dashboard/calendar"
                />
                <StatCard
                    title="Revenue"
                    value={`$${totalRevenue.toFixed(0)}`}
                    subtitle={`${totalPurchases} purchases`}
                    icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
                    href="/dashboard/payments"
                />
            </div>

            {/* Analytics Charts */}
            <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">30-Day Trends</h3>
                </div>
                <AnalyticsCharts data={chartData} />
            </div>

            {/* Conversion Funnel */}
            <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                <h3 className="font-semibold mb-4">Conversion Funnel</h3>
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <FunnelStep label="Conversations" value={conversationCount} color="bg-blue-500" widthPct={100} />
                    <FunnelArrow />
                    <FunnelStep label="Leads" value={leadCount} color="bg-yellow-500" widthPct={conversationCount > 0 ? Math.max(10, (leadCount / conversationCount) * 100) : 10} />
                    <FunnelArrow />
                    <FunnelStep label="Purchases" value={totalPurchases} color="bg-green-500" widthPct={leadCount > 0 ? Math.max(10, (totalPurchases / leadCount) * 100) : 10} />
                    <FunnelArrow />
                    <FunnelStep label="Revenue" value={`$${totalRevenue.toFixed(0)}`} color="bg-purple-500" widthPct={50} />
                </div>
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    {conversationCount > 0 && (
                        <span>Chat→Lead: {((leadCount / conversationCount) * 100).toFixed(1)}%</span>
                    )}
                    {leadCount > 0 && (
                        <span>Lead→Purchase: {((totalPurchases / leadCount) * 100).toFixed(1)}%</span>
                    )}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border bg-card text-card-foreground shadow">
                    <div className="flex items-center justify-between p-6 pb-4">
                        <h3 className="font-semibold">Recent Conversations</h3>
                        <Link href="/dashboard/conversations" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                            View all <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="px-6 pb-6">
                        {recentConversations.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-8 text-center">
                                No conversations yet. Share your profile to start chatting!
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {recentConversations.map((conv) => (
                                    <div key={conv.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <MessageSquare className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm">
                                                    {conv.visitorName || "Anonymous Visitor"}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatRelativeTime(conv.lastMessageAt)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {conv.messages[0]?.text || "No messages"}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border bg-card text-card-foreground shadow">
                    <div className="flex items-center justify-between p-6 pb-4">
                        <h3 className="font-semibold">Recent Leads</h3>
                        <Link href="/dashboard/leads" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                            View all <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="px-6 pb-6">
                        {recentLeads.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-8 text-center">
                                No leads yet. Your AI will collect contact info from interested visitors.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {recentLeads.map((lead) => (
                                    <div key={lead.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                                            <Users className="w-4 h-4 text-green-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium text-sm">{lead.name}</span>
                                                <StatusBadge status={lead.status} />
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {lead.email}
                                            </p>
                                            {lead.company && (
                                                <p className="text-xs text-muted-foreground mt-0.5">{lead.company}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                <h3 className="font-semibold mb-4">Quick Actions</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <QuickAction title="Edit Profile" description="Update your bio, headline, and settings" href="/dashboard/profile" />
                    <QuickAction title="Manage Services" description="Add or edit your service offerings" href="/dashboard/services" />
                    <QuickAction title="View Calendar" description="Check your upcoming bookings" href="/dashboard/calendar" />
                    <QuickAction title="Content Library" description="Upload documents for your AI to learn" href="/dashboard/content" />
                </div>
            </div>
        </div>
    )
}

function StatCard({ title, value, subtitle, icon, href, highlight = false }: {
    title: string; value: string | number; subtitle: string; icon: React.ReactNode; href: string; highlight?: boolean
}) {
    return (
        <Link href={href} className="block">
            <div className={`rounded-xl border bg-card text-card-foreground shadow p-6 hover:shadow-md transition-all hover:border-primary/50 ${highlight ? 'ring-2 ring-green-500/20' : ''}`}>
                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <h3 className="tracking-tight text-sm font-medium text-muted-foreground">{title}</h3>
                    {icon}
                </div>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            </div>
        </Link>
    )
}

function QuickAction({ title, description, href }: { title: string; description: string; href: string }) {
    return (
        <Link href={href}>
            <div className="p-4 rounded-lg border border-dashed hover:border-solid hover:bg-muted/50 transition-all cursor-pointer">
                <h4 className="font-medium text-sm">{title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </div>
        </Link>
    )
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        NEW: "bg-blue-500/10 text-blue-500",
        QUALIFIED: "bg-green-500/10 text-green-500",
        CONTACTED: "bg-yellow-500/10 text-yellow-500",
        CONVERTED: "bg-purple-500/10 text-purple-500",
        LOST: "bg-red-500/10 text-red-500"
    }
    return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] || "bg-muted text-muted-foreground"}`}>{status.toLowerCase()}</span>
}

function FunnelStep({ label, value, color, widthPct }: { label: string; value: string | number; color: string; widthPct: number }) {
    return (
        <div className="flex-1 flex flex-col items-center">
            <span className="text-xs text-muted-foreground mb-1">{label}</span>
            <div className="w-full flex justify-center">
                <div className={`${color} text-white rounded-lg py-3 text-center font-bold transition-all`} style={{ width: `${widthPct}%`, minWidth: '60px' }}>
                    {value}
                </div>
            </div>
        </div>
    )
}

function FunnelArrow() {
    return <div className="flex items-center justify-center text-muted-foreground text-lg sm:rotate-0 rotate-90">→</div>
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
