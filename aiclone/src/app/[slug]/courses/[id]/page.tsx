import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { CourseEnrollButton } from "@/components/catalog/enroll-button"
import { ORB_THEMES, resolveOrbVariant } from "@/lib/orb-variants"
import { CatalogHeader } from "@/components/shop/catalog-header"
import { OfferCover } from "@/components/dashboard/offer-cover"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { formatMoney } from "@/lib/pricing"
import { getRequestCurrency } from "@/lib/request-currency"

export const dynamic = "force-dynamic"

export default async function CourseSalesPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
    const { slug, id } = await params
    const currency = await getRequestCurrency()
    const course = await prisma.course.findFirst({
        where: { id, isActive: true, isPublished: true, profile: { slug, isPublic: true } },
        include: {
            profile: { include: { animationStyle: true } },
            modules: {
                orderBy: { orderIndex: "asc" },
                include: { lessons: { orderBy: { orderIndex: "asc" } } },
            },
        },
    })
    if (!course) notFound()

    let config: { colors?: string[]; variant?: string } = {}
    try {
        config = course.profile.animationStyle?.config ? JSON.parse(course.profile.animationStyle.config) : {}
    } catch {}
    const theme = ORB_THEMES[resolveOrbVariant(config.colors, config.variant)]
    const outcomes: string[] = (() => {
        try {
            const parsed = course.outcomes ? JSON.parse(course.outcomes) : []
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    })()
    const minutes = course.modules.reduce((n, m) => n + m.lessons.reduce((a, l) => a + l.durationMinutes, 0), 0)
    const lessons = course.modules.reduce((n, m) => n + m.lessons.length, 0)
    const price = course.priceCents === 0 ? "Free" : `${(course.priceCents / 100).toFixed(0)}`
    const logo = (course.profile as { shopLogoUrl?: string | null }).shopLogoUrl

    return (
        <div
            className="dark min-h-dvh bg-zinc-950 text-zinc-100"
            style={{
                ["--pl-aurora" as string]: theme.accent,
                ["--pl-brand-foreground" as string]: theme.onAccent,
            }}
        >
            <CatalogHeader
                slug={slug}
                name={course.profile.displayName}
                logoUrl={logo}
                label="Courses"
                backHref={`/${slug}/courses`}
            />
            <main className="mx-auto max-w-2xl space-y-6 px-4 py-5 pb-28">
                <OfferCover
                    src={course.thumbnailUrl}
                    kind={course.level || "COURSE"}
                    title={course.title}
                    className="aspect-square w-full overflow-hidden rounded-2xl"
                />
                <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{course.level === "ALL" ? "All levels" : course.level}</p>
                    <h1 className="text-3xl font-semibold">{course.title}</h1>
                    {course.subtitle && <p className="mt-2 text-lg text-zinc-300">{course.subtitle}</p>}
                    <p className="mt-3 text-sm text-zinc-400">
                        {course.modules.length} modules · {lessons} lessons
                        {minutes > 0 ? ` · ${Math.round(minutes / 60) || "<1"}h ${minutes % 60}m` : ""}
                    </p>
                </div>
                <div className="flex items-end gap-3">
                    <p className="text-3xl font-semibold">{price}</p>
                    {course.compareAtCents && course.compareAtCents > course.priceCents && (
                        <p className="pb-1 text-zinc-500 line-through">{formatMoney(course.compareAtCents, currency)}</p>
                    )}
                </div>
                {(course.body || course.description) && (
                    <div className="text-zinc-300">
                        <ChatMarkdown text={course.body || course.description || ""} />
                    </div>
                )}
                {outcomes.length > 0 && (
                    <section>
                        <h2 className="mb-2 font-medium">What you will learn</h2>
                        <ul className="space-y-2 text-sm text-zinc-300">
                            {outcomes.map((o) => (
                                <li key={o} className="flex gap-2">
                                    <span className="text-emerald-400">✓</span>
                                    <span>{o}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                <section className="space-y-3">
                    <h2 className="font-medium">Curriculum</h2>
                    {course.modules.map((mod) => (
                        <div key={mod.id} className="rounded-xl border border-white/10 p-3">
                            <p className="text-sm font-medium">{mod.title}</p>
                            <ul className="mt-2 space-y-1 text-sm text-zinc-400">
                                {mod.lessons.map((l) => (
                                    <li key={l.id} className="flex justify-between gap-2">
                                        <span>{l.title}{l.isFree ? " · Preview" : ""}</span>
                                        {l.durationMinutes > 0 && <span>{l.durationMinutes}m</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </section>
                <Link href={`/${slug}`} className="flex items-center gap-3 rounded-xl border border-white/10 p-3">
                    {course.profile.imageUrl && (
                        <img src={course.profile.imageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    )}
                    <div>
                        <p className="font-medium">{course.profile.displayName}</p>
                        <p className="text-xs text-zinc-500">{course.profile.headline}</p>
                    </div>
                </Link>
            </main>
            <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-zinc-950/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <CourseEnrollButton
                    item={{
                        itemType: "course",
                        itemId: course.id,
                        title: course.title,
                        priceCents: course.priceCents,
                        description: course.description,
                    }}
                />
            </div>
        </div>
    )
}
