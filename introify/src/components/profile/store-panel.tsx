"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Calendar,
    ChevronDown,
    DollarSign,
    GraduationCap,
    Package,
    Play,
    Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useMoney } from "@/components/pricing-provider"

export type StoreData = {
    displayName: string
    slug?: string
    digitalProducts?: Array<{
        id: string
        title: string
        description: string | null
        type: string
        priceCents: number
        currency?: string | null
        thumbnailUrl?: string | null
        fulfillment?: string | null
        stock?: number | null
    }>
    courses?: Array<{
        id: string
        title: string
        description: string | null
        priceCents: number
        thumbnailUrl?: string | null
        modules: Array<{
            title?: string
            lessons: Array<{ title?: string; durationMinutes?: number; isFree?: boolean }>
        }>
    }>
    events?: Array<{
        id: string
        title: string
        description: string | null
        eventType: string
        startTime: string
        endTime: string
        priceCents: number
        isFree: boolean
        thumbnailUrl?: string | null
    }>
    communities?: Array<{
        id: string
        name: string
        description: string | null
        platform: string
        priceCents: number
        billingCycle: string
    }>
}



function Cover({
    src,
    label,
    icon,
}: {
    src?: string | null
    label: string
    icon: React.ReactNode
}) {
    return (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-900">
            {src ? (
                <img src={src} alt="" className="h-full w-full object-cover" />
            ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-800 to-zinc-950 text-zinc-500">
                    {icon}
                    <span className="px-4 text-center text-xs font-medium text-zinc-400 line-clamp-2">{label}</span>
                </div>
            )}
        </div>
    )
}

export function ProductsStore({
    data,
    onPurchase,
}: {
    data: StoreData
    onPurchase?: (itemType: string, itemId: string) => void
}) {
    const money = useMoney()
    const products = data.digitalProducts || []
    if (products.length === 0) {
        return <EmptyStore label="No products in the shop yet." />
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
                {products.map((product) => (
                    <article key={product.id} className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70">
                        <Cover src={product.thumbnailUrl} label={product.title} icon={<Package className="h-7 w-7" />} />
                        <div className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="text-base font-semibold leading-tight">{product.title}</h3>
                                    {product.description && (
                                        <p className="mt-1 text-sm text-zinc-400 line-clamp-3">{product.description}</p>
                                    )}
                                </div>
                                <p className="shrink-0 text-lg font-semibold tabular-nums">{money(product.priceCents, product.currency)}</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                                    {product.fulfillment === "PHYSICAL" || product.fulfillment === "BOTH" ? "Physical" : product.type}
                                    {product.stock != null && product.stock <= 3 ? ` · ${product.stock <= 0 ? "Sold out" : `${product.stock} left`}` : ""}
                                </Badge>
                                <div className="flex gap-2">
                                    {data.slug && (
                                        <Button asChild variant="outline" size="sm" className="rounded-full border-white/15 bg-transparent text-white">
                                            <Link href={`/${data.slug}/shop/${product.id}`}>See</Link>
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => onPurchase?.("product", product.id)}
                                        className="h-9 rounded-full bg-brand px-4 text-brand-foreground hover:opacity-90"
                                    >
                                        <DollarSign className="mr-1 h-4 w-4" />
                                        {product.priceCents === 0 ? "Get" : "Buy"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    )
}

export function CoursesStore({
    data,
    onPurchase,
}: {
    data: StoreData
    onPurchase?: (itemType: string, itemId: string) => void
}) {
    const money = useMoney()
    const courses = data.courses || []
    const [openId, setOpenId] = useState<string | null>(courses[0]?.id ?? null)

    if (courses.length === 0) {
        return <EmptyStore label="No courses published yet." />
    }

    return (
        <div className="space-y-3">
            {courses.map((course) => {
                const lessons = course.modules.flatMap((m) => m.lessons)
                const minutes = lessons.reduce((n, l) => n + (l.durationMinutes || 0), 0)
                const open = openId === course.id
                return (
                    <article key={course.id} className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70">
                        <Cover src={course.thumbnailUrl} label={course.title} icon={<GraduationCap className="h-7 w-7" />} />
                        <div className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="text-base font-semibold leading-tight">{course.title}</h3>
                                    {course.description && (
                                        <p className="mt-1 text-sm text-zinc-400">{course.description}</p>
                                    )}
                                </div>
                                <p className="shrink-0 text-lg font-semibold tabular-nums">{money(course.priceCents)}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
                                <span className="rounded-full bg-white/5 px-2 py-1">{course.modules.length} modules</span>
                                <span className="rounded-full bg-white/5 px-2 py-1">{lessons.length} lessons</span>
                                {minutes > 0 && (
                                    <span className="rounded-full bg-white/5 px-2 py-1">{Math.round(minutes / 60) || "<1"}h {minutes % 60}m</span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpenId(open ? null : course.id)}
                                className="flex w-full items-center justify-between text-left text-sm text-zinc-300"
                            >
                                Curriculum
                                <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
                            </button>
                            {open && (
                                <ol className="space-y-2 border-t border-white/8 pt-2">
                                    {course.modules.map((mod, i) => (
                                        <li key={`${course.id}-m-${i}`}>
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                                                {mod.title || `Module ${i + 1}`}
                                            </p>
                                            <ul className="mt-1 space-y-1">
                                                {mod.lessons.map((lesson, j) => (
                                                    <li key={`${course.id}-l-${i}-${j}`} className="flex items-center gap-2 text-sm text-zinc-300">
                                                        <Play className="h-3 w-3 shrink-0 text-zinc-500" />
                                                        <span className="min-w-0 flex-1 truncate">{lesson.title || `Lesson ${j + 1}`}</span>
                                                        {lesson.isFree && (
                                                            <span className="text-[10px] text-emerald-400">Preview</span>
                                                        )}
                                                        {!!lesson.durationMinutes && (
                                                            <span className="text-[11px] text-zinc-500">{lesson.durationMinutes}m</span>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        </li>
                                    ))}
                                </ol>
                            )}
                            <div className="flex gap-2">
                                {data.slug && (
                                    <Button asChild variant="outline" className="h-10 flex-1 rounded-full border-white/15 bg-transparent text-white">
                                        <Link href={`/${data.slug}/courses/${course.id}`}>See course</Link>
                                    </Button>
                                )}
                                <Button
                                    onClick={() => onPurchase?.("course", course.id)}
                                    className="h-10 flex-1 rounded-full bg-brand text-brand-foreground hover:opacity-90"
                                >
                                    {course.priceCents === 0 ? "Enroll" : money(course.priceCents)}
                                </Button>
                            </div>
                        </div>
                    </article>
                )
            })}
        </div>
    )
}

export function EventsStore({
    data,
    onPurchase,
}: {
    data: StoreData
    onPurchase?: (itemType: string, itemId: string) => void
}) {
    const money = useMoney()
    const events = data.events || []
    if (events.length === 0) return <EmptyStore label="No upcoming events." />

    return (
        <div className="space-y-3">
            {events.map((event) => {
                const start = new Date(event.startTime)
                return (
                    <article key={event.id} className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70">
                        <Cover src={event.thumbnailUrl} label={event.title} icon={<Calendar className="h-7 w-7" />} />
                        <div className="space-y-3 p-4">
                            <div className="flex gap-3">
                                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-white/5">
                                    <span className="text-[10px] uppercase text-zinc-400">
                                        {start.toLocaleDateString("en-US", { month: "short" })}
                                    </span>
                                    <span className="text-xl font-semibold leading-none">{start.getDate()}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold leading-tight">{event.title}</h3>
                                    <p className="mt-1 text-xs text-zinc-400">
                                        {start.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}
                                        {" · "}
                                        {event.eventType}
                                    </p>
                                    {event.description && (
                                        <p className="mt-2 text-sm text-zinc-400 line-clamp-3">{event.description}</p>
                                    )}
                                </div>
                                <p className="shrink-0 font-semibold">{event.isFree ? "Free" : money(event.priceCents)}</p>
                            </div>
                            <div className="flex gap-2">
                                {data.slug && (
                                    <Button variant="outline" className="h-10 flex-1 rounded-full border-white/15 bg-transparent" asChild>
                                        <Link href={`/${data.slug}/events/${event.id}`}>See event</Link>
                                    </Button>
                                )}
                                <Button
                                    onClick={() => onPurchase?.("event", event.id)}
                                    className="h-10 flex-1 rounded-full bg-brand text-brand-foreground hover:opacity-90"
                                >
                                    Register
                                </Button>
                            </div>
                        </div>
                    </article>
                )
            })}
        </div>
    )
}

export function CommunitiesStore({
    data,
    onPurchase,
}: {
    data: StoreData
    onPurchase?: (itemType: string, itemId: string) => void
}) {
    const money = useMoney()
    const communities = data.communities || []
    if (communities.length === 0) return <EmptyStore label="No communities yet." />

    const cycle = (c: string) => (c === "MONTHLY" ? "/mo" : c === "YEARLY" ? "/yr" : "")

    return (
        <div className="space-y-3">
            {communities.map((community) => (
                <article key={community.id} className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-zinc-400" />
                                <h3 className="font-semibold">{community.name}</h3>
                            </div>
                            {community.description && (
                                <p className="mt-2 text-sm text-zinc-400">{community.description}</p>
                            )}
                            <Badge variant="secondary" className="mt-3 bg-zinc-800 text-zinc-300">{community.platform}</Badge>
                        </div>
                        <p className="shrink-0 text-lg font-semibold">
                            {community.priceCents === 0 ? "Free" : `${money(community.priceCents)}${cycle(community.billingCycle)}`}
                        </p>
                    </div>
                    <Button
                        onClick={() => onPurchase?.("community", community.id)}
                        className="mt-4 h-10 w-full rounded-full bg-brand text-brand-foreground hover:opacity-90"
                    >
                        Join
                    </Button>
                </article>
            ))}
        </div>
    )
}

function EmptyStore({ label }: { label: string }) {
    return <p className="py-12 text-center text-zinc-500">{label}</p>
}
