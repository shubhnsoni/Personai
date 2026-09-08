import { redirect } from "next/navigation"
import Link from "next/link"
import { getMemberFromSession } from "@/lib/members"
import { prisma } from "@/lib/prisma"
import { logoutLibrary } from "@/app/actions/library"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function LibraryPage() {
    const member = await getMemberFromSession()
    if (!member) redirect("/library/login")

    const [enrollments, purchases, events, rooms, bookings] = await Promise.all([
        prisma.courseEnrollment.findMany({
            where: {
                OR: [{ memberId: member.id }, { visitorEmail: member.email }],
                status: { in: ["ACTIVE", "COMPLETED"] },
            },
            include: {
                course: { include: { profile: true, modules: { include: { lessons: true } } } },
                lessonCompletions: true,
            },
            orderBy: { enrolledAt: "desc" },
        }),
        prisma.productPurchase.findMany({
            where: {
                OR: [{ memberId: member.id }, { visitorEmail: member.email }],
                status: "COMPLETED",
            },
            include: { product: { include: { profile: true } } },
            orderBy: { createdAt: "desc" },
        }),
        prisma.eventRegistration.findMany({
            where: {
                OR: [{ memberId: member.id }, { visitorEmail: member.email }],
                status: { not: "CANCELLED" },
            },
            include: { event: { include: { profile: true } } },
            orderBy: { createdAt: "desc" },
        }),
        prisma.communityMember.findMany({
            where: {
                OR: [{ memberId: member.id }, { visitorEmail: member.email }],
                status: "ACTIVE",
            },
            include: { community: { include: { profile: true } } },
            orderBy: { createdAt: "desc" },
        }),
        prisma.booking.findMany({
            where: {
                OR: [{ memberId: member.id }, { visitorEmail: member.email }],
                status: { not: "CANCELLED" },
            },
            include: { serviceOffering: true, profile: true },
            orderBy: { startTime: "asc" },
        }),
    ])

    const continueCourse = enrollments.find((e) => {
        const total = e.course.modules.reduce((n, m) => n + m.lessons.length, 0)
        return e.lessonCompletions.length < total
    }) || enrollments[0]

    return (
        <div className="dark min-h-dvh bg-zinc-950 text-zinc-100">
            <header className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
                <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Library</p>
                    <h1 className="truncate text-lg font-semibold">{member.name || "Your library"}</h1>
                    <p className="truncate text-xs text-zinc-500">{member.email}</p>
                </div>
                <form action={logoutLibrary}>
                    <Button type="submit" variant="ghost" className="text-zinc-400">Sign out</Button>
                </form>
            </header>

            <main className="mx-auto max-w-2xl space-y-6 px-4 py-5 pb-16">
                {continueCourse && (
                    <Link
                        href={`/library/courses/${continueCourse.courseId}`}
                        className="block overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 p-4"
                    >
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Continue</p>
                        <p className="mt-1 text-lg font-semibold">{continueCourse.course.title}</p>
                        <p className="text-sm text-zinc-400">by {continueCourse.course.profile.displayName}</p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                                className="h-full bg-emerald-400"
                                style={{
                                    width: `${progressPct(continueCourse.lessonCompletions.length, continueCourse.course.modules.reduce((n, m) => n + m.lessons.length, 0))}%`,
                                }}
                            />
                        </div>
                    </Link>
                )}

                <Section title="Courses">
                    {enrollments.length === 0 && <Empty>No courses yet.</Empty>}
                    {enrollments.map((e) => (
                        <Link key={e.id} href={`/library/courses/${e.courseId}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-zinc-900/50 px-3 py-3">
                            <div className="min-w-0">
                                <p className="truncate font-medium">{e.course.title}</p>
                                <p className="text-xs text-zinc-500">{e.course.profile.displayName}</p>
                            </div>
                            <span className="text-xs text-zinc-400">
                                {e.lessonCompletions.length}/{e.course.modules.reduce((n, m) => n + m.lessons.length, 0)}
                            </span>
                        </Link>
                    ))}
                </Section>

                <Section title="Downloads">
                    {purchases.length === 0 && <Empty>No products yet.</Empty>}
                    {purchases.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-zinc-900/50 px-3 py-3">
                            <div className="min-w-0">
                                <p className="truncate font-medium">{p.product.title}</p>
                                <p className="text-xs text-zinc-500">{p.product.profile.displayName}</p>
                            </div>
                            {p.downloadToken ? (
                                <a href={`/api/downloads/${p.downloadToken}`} className="text-sm text-emerald-400">Download</a>
                            ) : p.product.fileUrl ? (
                                <a href={p.product.fileUrl} className="text-sm text-emerald-400">Open</a>
                            ) : (
                                <span className="text-xs text-zinc-500">Ready</span>
                            )}
                        </div>
                    ))}
                </Section>

                <Section title="Events">
                    {events.length === 0 && <Empty>No events.</Empty>}
                    {events.map((r) => (
                        <div key={r.id} className="rounded-xl border border-white/8 bg-zinc-900/50 px-3 py-3">
                            <p className="font-medium">{r.event.title}</p>
                            <p className="text-xs text-zinc-500">
                                {new Date(r.event.startTime).toLocaleString()} · {r.event.profile.displayName}
                            </p>
                            {r.event.meetingUrl && (
                                <a href={r.event.meetingUrl} className="mt-2 inline-block text-sm text-emerald-400">Join meeting</a>
                            )}
                        </div>
                    ))}
                </Section>

                <Section title="Rooms">
                    {rooms.length === 0 && <Empty>No communities.</Empty>}
                    {rooms.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-zinc-900/50 px-3 py-3">
                            <div>
                                <p className="font-medium">{m.community.name}</p>
                                <p className="text-xs text-zinc-500">{m.community.platform}</p>
                            </div>
                            {m.community.inviteLink && (
                                <a href={m.community.inviteLink} className="text-sm text-emerald-400">Open</a>
                            )}
                        </div>
                    ))}
                </Section>

                <Section title="Calls">
                    {bookings.length === 0 && <Empty>No bookings.</Empty>}
                    {bookings.map((b) => (
                        <div key={b.id} className="rounded-xl border border-white/8 bg-zinc-900/50 px-3 py-3">
                            <p className="font-medium">{b.serviceOffering.name}</p>
                            <p className="text-xs text-zinc-500">
                                {new Date(b.startTime).toLocaleString()} · {b.profile.displayName}
                            </p>
                        </div>
                    ))}
                </Section>
            </main>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <h2 className="text-sm font-medium text-zinc-400">{title}</h2>
            <div className="space-y-2">{children}</div>
        </section>
    )
}

function Empty({ children }: { children: React.ReactNode }) {
    return <p className="text-sm text-zinc-600">{children}</p>
}

function progressPct(done: number, total: number) {
    if (!total) return 0
    return Math.round((done / total) * 100)
}
