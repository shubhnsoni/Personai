import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { LeadsStudio, type StudioLead } from "@/components/dashboard/leads-studio"
import { parseLeadTags } from "@/lib/lead-meta"
import { requireSurface } from "@/lib/require-surface"
import { isJewelryWholesale } from "@/lib/metal/math"
import { listParties } from "@/lib/metal/ledger"

export const dynamic = "force-dynamic"

export default async function DashboardLeadsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "leads", profile)

    const parties = isJewelryWholesale(profile.roleTemplate)
        ? await listParties(profile.id)
        : []

    const [leads, conversations, purchases, enrollments, bookings] = await Promise.all([
        prisma.visitorLead.findMany({
            where: { profileId: profile.id },
            orderBy: { createdAt: "desc" },
        }),
        prisma.conversation.findMany({
            where: { profileId: profile.id },
            include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
            orderBy: { lastMessageAt: "desc" },
        }),
        prisma.productPurchase.findMany({
            where: { product: { profileId: profile.id } },
            include: { product: { select: { title: true } } },
        }),
        prisma.courseEnrollment.findMany({
            where: { course: { profileId: profile.id } },
            include: { course: { select: { title: true } } },
        }),
        prisma.booking.findMany({
            where: { profileId: profile.id },
            select: { visitorEmail: true },
        }),
    ])

    const convById = new Map(conversations.map((c) => [c.id, c]))
    const convByEmail = new Map<string, (typeof conversations)[0]>()
    for (const c of conversations) {
        if (c.visitorEmail) {
            const k = c.visitorEmail.toLowerCase()
            if (!convByEmail.has(k)) convByEmail.set(k, c)
        }
    }

    const rows: StudioLead[] = leads.map((l) => {
        const email = l.email.toLowerCase()
        const chat = (l.conversationId && convById.get(l.conversationId)) || convByEmail.get(email) || null
        const tags = parseLeadTags(l.tags)
        const last = chat?.messages[0]
        return {
            id: l.id,
            name: l.name,
            email: l.email,
            company: l.company,
            budgetRange: l.budgetRange,
            status: l.status,
            note: tags.note || "",
            followUpAt: tags.followUpAt || null,
            activity: tags.activity || [],
            createdAt: l.createdAt.toISOString(),
            chatId: chat?.id || null,
            lastChat: last?.text || null,
            waitingOnYou: Boolean(last && last.role === "user"),
            purchases: purchases.filter((p) => p.visitorEmail.toLowerCase() === email).map((p) => p.product.title),
            courses: enrollments.filter((e) => e.visitorEmail.toLowerCase() === email).map((e) => e.course.title),
            bookings: bookings.filter((b) => b.visitorEmail.toLowerCase() === email).length,
        }
    })

    return (
        <div className="space-y-4">
            {parties.length ? (
                <div className="studio-panel divide-y divide-white/8 rounded-2xl">
                    {parties.map((p) => (
                        <div key={p.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                                <p className="text-sm font-medium">{p.displayName}</p>
                                <p className="text-[12px] text-muted-foreground">{p.kind.toLowerCase()}{p.phone ? ` · ${p.phone}` : ""} · {p.termsDays}d</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
            <LeadsStudio leads={rows} slug={profile.slug} displayName={profile.displayName} />
        </div>
    )
}
