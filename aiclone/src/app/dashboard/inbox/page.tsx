import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { InboxPeople, type InboxMember } from "@/components/dashboard/inbox-people"

export const dynamic = "force-dynamic"

export default async function InboxPage({
    searchParams,
}: {
    searchParams: Promise<{ c?: string }>
}) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    const { c } = await searchParams

    const [conversations, leads, purchases, enrollments, eventRegs, rooms] = await Promise.all([
        prisma.conversation.findMany({
            where: { profileId: profile.id },
            include: { messages: { orderBy: { createdAt: "asc" } } },
            orderBy: { lastMessageAt: "desc" },
        }),
        prisma.visitorLead.findMany({
            where: { profileId: profile.id },
            orderBy: { createdAt: "desc" },
        }),
        prisma.productPurchase.findMany({
            where: { product: { profileId: profile.id } },
            include: { product: { select: { title: true } } },
        }),
        prisma.courseEnrollment.findMany({
            where: { course: { profileId: profile.id } },
            include: { course: { select: { title: true } } },
        }),
        prisma.eventRegistration.findMany({
            where: { event: { profileId: profile.id } },
            include: { event: { select: { title: true } } },
        }),
        prisma.communityMember.findMany({
            where: { community: { profileId: profile.id } },
            include: { community: { select: { name: true } } },
        }),
    ])

    const memberMap = new Map<string, InboxMember>()
    const touch = (
        email: string,
        name: string | null | undefined,
        at: Date,
        extra: { purchase?: string; course?: string }
    ) => {
        if (!email) return
        const key = email.toLowerCase()
        const cur = memberMap.get(key) || {
            email,
            name: name || null,
            purchases: [],
            courses: [],
            lastAt: 0,
        }
        if (name && !cur.name) cur.name = name
        if (extra.purchase && !cur.purchases.includes(extra.purchase)) cur.purchases.push(extra.purchase)
        if (extra.course && !cur.courses.includes(extra.course)) cur.courses.push(extra.course)
        const t = +at
        if (t > (cur.lastAt || 0)) cur.lastAt = t
        memberMap.set(key, cur)
    }

    for (const p of purchases) {
        touch(p.visitorEmail, p.visitorName, p.createdAt, { purchase: p.product.title })
    }
    for (const e of enrollments) {
        touch(e.visitorEmail, e.visitorName, e.enrolledAt, { course: e.course.title })
    }
    for (const r of eventRegs) {
        touch(r.visitorEmail, r.visitorName, r.createdAt, { purchase: r.event.title })
    }
    for (const m of rooms) {
        touch(m.visitorEmail, m.visitorName, m.createdAt, { purchase: m.community.name })
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
        <InboxPeople
            profileId={profile.id}
            initialSelected={c || null}
            conversations={conversations.map((c) => ({
                id: c.id,
                visitorName: c.visitorName,
                visitorEmail: c.visitorEmail,
                lastMessageAt: c.lastMessageAt.toISOString(),
                mode: (c as { mode?: string }).mode || "AI",
                messages: c.messages.map((m) => ({
                    id: m.id,
                    role: m.role,
                    text: m.text,
                    createdAt: m.createdAt.toISOString(),
                    senderType: m.senderType,
                })),
            }))}
            leads={leads.map((l) => ({
                id: l.id,
                name: l.name,
                email: l.email,
                company: l.company,
                budgetRange: l.budgetRange,
                status: l.status,
                createdAt: l.createdAt.toISOString(),
            }))}
            members={[...memberMap.values()]}
            mode="chats"
        />
        </div>
    )
}
