"use client"

import NextImage from "next/image"
import { X, ChevronLeft, ChevronRight, ArrowUp, Clock, Calendar, DollarSign } from "lucide-react"
import { CommunitiesStore, CoursesStore, EventsStore, ProductsStore } from "@/components/profile/store-panel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import { useMoney } from "@/components/pricing-provider"

interface ContentPanelProps {
    isOpen: boolean
    onClose: () => void
    type: "about" | "experience" | "projects" | "services" | "products" | "courses" | "events" | "communities" | null
    data: {
        displayName: string
        slug?: string
        headline: string | null
        bio: string | null
        contentDisplayMode?: string
        imageUrl?: string | null
        workExperiences: Array<{
            id: string
            company: string
            role: string
            startDate: string
            endDate: string | null
            description: string | null
            achievements: string | null
        }>
        projects: Array<{
            id: string
            title: string
            description: string | null
            client: string | null
            year: string | null
            imageUrl: string | null
            link: string | null
        }>
        serviceOfferings: Array<{
            id: string
            name: string
            description: string | null
            priceCents: number
            isFree: boolean
            durationMinutes: number
            isActive: boolean
        }>
        digitalProducts?: Array<{
            id: string
            title: string
            description: string | null
            type: string
            priceCents: number
            thumbnailUrl?: string | null
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
    onBookService?: (serviceId: string) => void
    onPurchase?: (itemType: string, itemId: string) => void
}

export function ContentPanel({ isOpen, onClose, type, data, onBookService, onPurchase }: ContentPanelProps) {
    const getTitle = () => {
        switch (type) {
            case "experience": return "Work Experience"
            case "projects": return "Projects"
            case "about": return `About ${data.displayName}`
            case "services": return "Services & Pricing"
            case "products": return "Digital Products"
            case "courses": return "Courses"
            case "events": return "Events"
            case "communities": return "Communities"
            default: return ""
        }
    }

    const content = (
        <div className="flex-1 relative h-full flex flex-col">
            <div className="flex items-center justify-between px-3 py-3 sm:p-5 border-b border-white/8 bg-black/40 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onClose} 
                        className="rounded-full hover:bg-zinc-800 bg-black/20 backdrop-blur-sm text-white"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                    <h2 className="text-xl font-semibold text-white drop-shadow-md">{getTitle()}</h2>
                </div>

            </div>

            <div className="flex-1 relative overflow-hidden">
                {type === "experience" && (
                    <ScrollArea className="h-full px-3 py-4 sm:p-6">
                        <div className="max-w-3xl mx-auto space-y-6 pb-16">
                            <ExperienceView data={data} />
                        </div>
                    </ScrollArea>
                )}
                {type === "projects" && <ProjectsView data={data} />}
                {type === "about" && (
                    <ScrollArea className="h-full p-6">
                        <div className="max-w-3xl mx-auto space-y-8 pb-20">
                            <AboutView data={data} />
                        </div>
                    </ScrollArea>
                )}
                {type === "services" && (
                    <ScrollArea className="h-full px-3 py-4 sm:p-6">
                        <div className="max-w-3xl mx-auto space-y-5 pb-16">
                            <ServicesView data={data} onBook={onBookService} />
                        </div>
                    </ScrollArea>
                )}
                {type === "products" && (
                    <ScrollArea className="h-full px-3 py-4 sm:p-6">
                        <div className="max-w-3xl mx-auto space-y-5 pb-16">
                            <ProductsStore data={data} onPurchase={onPurchase} />
                        </div>
                    </ScrollArea>
                )}
                {type === "courses" && (
                    <ScrollArea className="h-full px-3 py-4 sm:p-6">
                        <div className="max-w-3xl mx-auto space-y-5 pb-16">
                            <CoursesStore data={data} onPurchase={onPurchase} />
                        </div>
                    </ScrollArea>
                )}
                {type === "events" && (
                    <ScrollArea className="h-full px-3 py-4 sm:p-6">
                        <div className="max-w-3xl mx-auto space-y-5 pb-16">
                            <EventsStore data={data} onPurchase={onPurchase} />
                        </div>
                    </ScrollArea>
                )}
                {type === "communities" && (
                    <ScrollArea className="h-full px-3 py-4 sm:p-6">
                        <div className="max-w-3xl mx-auto space-y-5 pb-16">
                            <CommunitiesStore data={data} onPurchase={onPurchase} />
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    )

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6 lg:hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 40 }}
                            className="relative flex h-[min(88dvh,100%)] w-full min-h-0 flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-zinc-950 shadow-2xl sm:h-[min(82dvh,40rem)] sm:max-w-lg sm:rounded-2xl sm:border"
                        >
                            {content}
                        </motion.div>
                    </div>

                    <motion.aside
                        initial={{ width: "0%" }}
                        animate={{ width: "56%" }}
                        exit={{ width: "0%" }}
                        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                        className="relative z-10 hidden h-full min-h-0 shrink-0 overflow-hidden border-l border-white/10 bg-zinc-950 lg:flex lg:flex-col"
                    >
                        <div className="flex h-full min-h-0 w-full min-w-[22rem] flex-col">
                            {content}
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    )
}

function ExperienceView({ data }: { data: ContentPanelProps["data"] }) {
    const experiences = data.workExperiences
    if (experiences.length === 0) {
        return <p className="py-16 text-center text-sm text-zinc-500">No work history yet.</p>
    }

    return (
        <div className="space-y-0">
            {experiences.map((exp) => {
                let achievements: string[] = []
                if (exp.achievements) {
                    try {
                        achievements = JSON.parse(exp.achievements)
                    } catch {
                        achievements = [exp.achievements]
                    }
                }

                return (
                    <div key={exp.id} className="relative border-l border-white/10 pl-4 pb-6 last:pb-0">
                        <div className="absolute -left-[4px] top-1.5 h-2 w-2 rounded-full bg-cyan-400" />
                        <p className="text-sm font-medium text-white">{exp.role}</p>
                        <p className="mt-0.5 text-xs text-zinc-400">
                            {exp.company} · {exp.startDate} – {exp.endDate || "Present"}
                        </p>
                        {exp.description ? (
                            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{exp.description}</p>
                        ) : null}
                        {achievements.length > 0 ? (
                            <ul className="mt-2 space-y-1.5">
                                {achievements.map((achievement, j) => (
                                    <li key={j} className="flex items-start gap-2 text-sm text-zinc-300">
                                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                                        {achievement}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                )
            })}
        </div>
    )
}

function ProjectsView({ data }: { data: ContentPanelProps["data"] }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [showDetail, setShowDetail] = useState(false)
    const projects = data.projects
    const current = projects[currentIndex]

    if (projects.length === 0) {
        return <p className="px-4 py-16 text-center text-sm text-zinc-500">No projects yet.</p>
    }

    const next = (e?: React.MouseEvent) => {
        e?.stopPropagation()
        setCurrentIndex((i) => (i + 1) % projects.length)
    }
    const prev = (e?: React.MouseEvent) => {
        e?.stopPropagation()
        setCurrentIndex((i) => (i - 1 + projects.length) % projects.length)
    }

    return (
        <div className="relative flex h-full min-h-0 flex-col bg-zinc-900">
            <div className="relative min-h-0 flex-1 cursor-pointer overflow-hidden" onClick={() => setShowDetail(true)}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={current.id}
                        initial={{ opacity: 0, scale: 1.04 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35 }}
                        className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950"
                    >
                        {current.imageUrl ? (
                            <NextImage src={current.imageUrl} alt={current.title} fill className="object-cover opacity-55" priority />
                        ) : (
                            <div className="flex h-full items-center justify-center text-3xl font-bold text-zinc-700/40 select-none">
                                {current.client || "Project"}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />

                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-16">
                    <motion.div
                        key={`copy-${current.id}`}
                        initial={{ y: 12, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="max-w-xl space-y-2"
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            {current.client ? (
                                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] text-white">
                                    {current.client}
                                </span>
                            ) : null}
                            {current.year ? <span className="text-xs text-zinc-400">{current.year}</span> : null}
                        </div>
                        <h2 className="text-2xl font-semibold leading-tight text-white">{current.title}</h2>
                        {current.description ? (
                            <p className="line-clamp-2 text-sm text-zinc-300">{current.description}</p>
                        ) : null}
                    </motion.div>
                </div>

                {projects.length > 1 ? (
                    <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur-md">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-white/15" onClick={prev} aria-label="Previous project">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="min-w-10 text-center text-[11px] text-white/80">
                            {currentIndex + 1} / {projects.length}
                        </span>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-white/15" onClick={next} aria-label="Next project">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                ) : null}
            </div>

            <AnimatePresence>
                {showDetail && (
                    <motion.div
                        initial={{ opacity: 0, y: "100%" }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: "100%" }}
                        className="absolute inset-0 z-30 flex flex-col bg-zinc-950"
                    >
                        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-white/8 px-2">
                            <button type="button" onClick={() => setShowDetail(false)} className="flex h-9 items-center gap-1 rounded-full px-2 text-sm text-zinc-400 hover:bg-white/10 hover:text-white">
                                <ChevronLeft className="h-4 w-4" />
                                Gallery
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                                    {current.client ? <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-cyan-300">{current.client}</span> : null}
                                    {current.year ? <span>{current.year}</span> : null}
                                </div>
                                <h3 className="text-2xl font-semibold text-white">{current.title}</h3>
                                <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                                    {current.imageUrl ? (
                                        <NextImage src={current.imageUrl} alt={current.title} fill className="object-cover" />
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-sm text-zinc-600">No image</div>
                                    )}
                                </div>
                                {current.description ? (
                                    <p className="text-sm leading-relaxed text-zinc-300">{current.description}</p>
                                ) : null}
                                {current.link ? (
                                    <a href={current.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-cyan-300 hover:text-cyan-200">
                                        Open project <ArrowUp className="h-3.5 w-3.5 rotate-45" />
                                    </a>
                                ) : null}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function AboutView({ data }: { data: ContentPanelProps["data"] }) {
    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/10 bg-zinc-800">
                    {data.imageUrl ? (
                        <img src={data.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-medium text-white/50">
                            {data.displayName.charAt(0)}
                        </div>
                    )}
                </div>
                <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-white">{data.displayName}</h2>
                    <p className="truncate text-sm text-zinc-400">{data.headline || "Creator"}</p>
                </div>
            </div>
            {data.bio ? (
                <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">{data.bio}</p>
            ) : (
                <p className="text-sm text-zinc-500">No bio yet.</p>
            )}
        </div>
    )
}

function ServicesView({ data, onBook }: { data: ContentPanelProps["data"]; onBook?: (serviceId: string) => void }) {
    const money = useMoney()
    const services = data.serviceOfferings.filter((s) => s.isActive)

    if (services.length === 0) {
        return <p className="py-16 text-center text-sm text-zinc-500">No services to book right now.</p>
    }

    return (
        <div className="space-y-3">
            {services.map((service) => (
                <div key={service.id} className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-white">{service.name}</h3>
                            {service.description ? (
                                <p className="mt-1 text-sm text-zinc-400">{service.description}</p>
                            ) : null}
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-white">{money(service.priceCents)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <Clock className="h-3.5 w-3.5" />
                            {service.durationMinutes} min
                        </span>
                        <Button
                            onClick={() => onBook?.(service.id)}
                            className="h-9 rounded-full bg-brand px-4 text-brand-foreground hover:opacity-90"
                        >
                            <Calendar className="mr-1.5 h-3.5 w-3.5" />
                            Book
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}

function _RemovedProductsView({ data, onPurchase }: { data: ContentPanelProps["data"]; onPurchase?: (itemType: string, itemId: string) => void }) {
    const products = data.digitalProducts || []

    if (products.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-zinc-500">No products available at the moment.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <p className="text-zinc-400 mb-6">
                Browse {data.displayName}&apos;s digital products.
            </p>
            {products.map((product) => (
                <div 
                    key={product.id} 
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4 hover:border-zinc-700 transition-colors"
                >
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h3 className="text-xl font-semibold">{product.title}</h3>
                            {product.description && (
                                <p className="text-zinc-400 text-sm">{product.description}</p>
                            )}
                            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 mt-2">
                                {product.type}
                            </Badge>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold">
                                {product.priceCents === 0 ? "Free" : `$${(product.priceCents / 100).toFixed(0)}`}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-end">
                        <Button 
                            onClick={() => onPurchase?.("product", product.id)}
                            className="bg-brand text-brand-foreground hover:opacity-90"
                        >
                            <DollarSign className="w-4 h-4 mr-2" />
                            Purchase
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}

function CoursesView({ data, onPurchase }: { data: ContentPanelProps["data"]; onPurchase?: (itemType: string, itemId: string) => void }) {
    const courses = data.courses || []

    if (courses.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-zinc-500">No courses available at the moment.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <p className="text-zinc-400 mb-6">
                Enroll in {data.displayName}&apos;s courses.
            </p>
            {courses.map((course) => {
                const totalLessons = course.modules.reduce((acc, mod) => acc + mod.lessons.length, 0)
                return (
                    <div 
                        key={course.id} 
                        className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4 hover:border-zinc-700 transition-colors"
                    >
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <h3 className="text-xl font-semibold">{course.title}</h3>
                                {course.description && (
                                    <p className="text-zinc-400 text-sm">{course.description}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold">
                                    {course.priceCents === 0 ? "Free" : `$${(course.priceCents / 100).toFixed(0)}`}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-sm text-zinc-500">
                                <span className="flex items-center gap-1.5">
                                    {course.modules.length} modules · {totalLessons} lessons
                                </span>
                            </div>
                            <Button 
                                onClick={() => onPurchase?.("course", course.id)}
                                className="bg-brand text-brand-foreground hover:opacity-90"
                            >
                                <DollarSign className="w-4 h-4 mr-2" />
                                Purchase
                            </Button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function EventsView({ data, onPurchase }: { data: ContentPanelProps["data"]; onPurchase?: (itemType: string, itemId: string) => void }) {
    const events = data.events || []

    if (events.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-zinc-500">No events available at the moment.</p>
            </div>
        )
    }

    const formatEventDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        })
    }

    return (
        <div className="space-y-4">
            <p className="text-zinc-400 mb-6">
                Register for {data.displayName}&apos;s upcoming events.
            </p>
            {events.map((event) => (
                <div 
                    key={event.id} 
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4 hover:border-zinc-700 transition-colors"
                >
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h3 className="text-xl font-semibold">{event.title}</h3>
                            {event.description && (
                                <p className="text-zinc-400 text-sm">{event.description}</p>
                            )}
                            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 mt-2">
                                {event.eventType}
                            </Badge>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold">
                                {event.isFree ? "Free" : `$${(event.priceCents / 100).toFixed(0)}`}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-zinc-500">
                            <span className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                {formatEventDate(event.startTime)}
                            </span>
                        </div>
                        <Button 
                            onClick={() => onPurchase?.("event", event.id)}
                            className="bg-brand text-brand-foreground hover:opacity-90"
                        >
                            <Calendar className="w-4 h-4 mr-2" />
                            Register
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}

function CommunitiesView({ data, onPurchase }: { data: ContentPanelProps["data"]; onPurchase?: (itemType: string, itemId: string) => void }) {
    const communities = data.communities || []

    if (communities.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-zinc-500">No communities available at the moment.</p>
            </div>
        )
    }

    const formatBillingCycle = (cycle: string) => {
        switch (cycle) {
            case 'MONTHLY': return '/month'
            case 'YEARLY': return '/year'
            case 'ONE_TIME': return ''
            default: return ''
        }
    }

    return (
        <div className="space-y-4">
            <p className="text-zinc-400 mb-6">
                Join {data.displayName}&apos;s communities.
            </p>
            {communities.map((community) => (
                <div 
                    key={community.id} 
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4 hover:border-zinc-700 transition-colors"
                >
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h3 className="text-xl font-semibold">{community.name}</h3>
                            {community.description && (
                                <p className="text-zinc-400 text-sm">{community.description}</p>
                            )}
                            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 mt-2">
                                {community.platform}
                            </Badge>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold">
                                {community.priceCents === 0 ? "Free" : `$${(community.priceCents / 100).toFixed(0)}${formatBillingCycle(community.billingCycle)}`}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-end">
                        <Button 
                            onClick={() => onPurchase?.("community", community.id)}
                            className="bg-brand text-brand-foreground hover:opacity-90"
                        >
                            Join
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}
