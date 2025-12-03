"use client"

import NextImage from "next/image"
import { X, Download, ArrowUp, ArrowDown, Clock, DollarSign, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface ContentPanelProps {
    isOpen: boolean
    onClose: () => void
    type: "about" | "experience" | "projects" | "services" | "products" | "courses" | "events" | "communities" | null
    data: {
        displayName: string
        headline: string | null
        bio: string | null
        contentDisplayMode?: string
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
        }>
        courses?: Array<{
            id: string
            title: string
            description: string | null
            priceCents: number
            modules: Array<{ lessons: Array<object> }>
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
    const mode = data.contentDisplayMode || "SIDE_PANEL"

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
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md z-10">
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
                {type === "experience" && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2 rounded-full bg-black/20 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 hover:text-white"
                    >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Download CV</span>
                    </Button>
                )}
            </div>

            <div className="flex-1 relative overflow-hidden">
                {type === "experience" && (
                    <ScrollArea className="h-full p-6">
                        <div className="max-w-3xl mx-auto space-y-8 pb-20">
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
                    <ScrollArea className="h-full p-6">
                        <div className="max-w-3xl mx-auto space-y-6 pb-20">
                            <ServicesView data={data} onBook={onBookService} />
                        </div>
                    </ScrollArea>
                )}
                {type === "products" && (
                    <ScrollArea className="h-full p-6">
                        <div className="max-w-3xl mx-auto space-y-6 pb-20">
                            <ProductsView data={data} onPurchase={onPurchase} />
                        </div>
                    </ScrollArea>
                )}
                {type === "courses" && (
                    <ScrollArea className="h-full p-6">
                        <div className="max-w-3xl mx-auto space-y-6 pb-20">
                            <CoursesView data={data} onPurchase={onPurchase} />
                        </div>
                    </ScrollArea>
                )}
                {type === "events" && (
                    <ScrollArea className="h-full p-6">
                        <div className="max-w-3xl mx-auto space-y-6 pb-20">
                            <EventsView data={data} onPurchase={onPurchase} />
                        </div>
                    </ScrollArea>
                )}
                {type === "communities" && (
                    <ScrollArea className="h-full p-6">
                        <div className="max-w-3xl mx-auto space-y-6 pb-20">
                            <CommunitiesView data={data} onPurchase={onPurchase} />
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
                    {mode === "SIDE_PANEL" ? (
                        <motion.div
                            initial={{ x: "100%", opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: "100%", opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 w-full lg:w-[60%] bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex flex-col"
                        >
                            {content}
                        </motion.div>
                    ) : (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={onClose}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-5xl h-[85vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                            >
                                {content}
                            </motion.div>
                        </div>
                    )}
                </>
            )}
        </AnimatePresence>
    )
}

function ExperienceView({ data }: { data: ContentPanelProps["data"] }) {
    const experiences = data.workExperiences.length > 0
        ? data.workExperiences
        : [
            {
                id: "mock-1",
                role: "Principal Product Designer",
                company: "Parloa",
                startDate: "2022",
                endDate: null,
                description: "Leading design for AI conversational agents. Helped secure Series A, B, and C funding.",
                achievements: JSON.stringify([
                    "Led design of two 0-1 products driving €20M+ revenue",
                    "Created company-wide design system",
                    "Hired and mentored 3 product designers"
                ])
            },
            {
                id: "mock-2",
                role: "Co-Founder & Lead Designer",
                company: "SomethingCreative",
                startDate: "2018",
                endDate: "2022",
                description: "Founded a full-service design agency working with early-stage startups.",
                achievements: JSON.stringify([
                    "Scaled agency to 15 employees",
                    "Delivered 50+ successful client projects",
                    "Won Awwwards Site of the Day"
                ])
            }
        ]

    return (
        <div className="space-y-12">
            {experiences.map((exp, i) => {
                let achievements: string[] = []
                if (exp.achievements) {
                    try {
                        achievements = JSON.parse(exp.achievements)
                    } catch {
                        achievements = [exp.achievements]
                    }
                }

                return (
                    <div key={exp.id || i} className="relative pl-8 border-l border-zinc-800 space-y-4">
                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-purple-500 ring-4 ring-zinc-950" />

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-xl font-bold">{exp.role}</h3>
                                <div className="text-zinc-400 flex items-center gap-2">
                                    <span className="font-medium text-zinc-300">{exp.company}</span>
                                    <span>·</span>
                                    <span>{exp.startDate} - {exp.endDate || "Present"}</span>
                                </div>
                            </div>
                            <Badge variant="secondary" className="w-fit bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                                {exp.company}
                            </Badge>
                        </div>

                        {exp.description && (
                            <p className="text-zinc-400 leading-relaxed">{exp.description}</p>
                        )}

                        {achievements.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Key Achievements</h4>
                                <ul className="space-y-2">
                                    {achievements.map((achievement, j) => (
                                        <li key={j} className="flex items-start gap-3 text-zinc-300 text-sm">
                                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                                            {achievement}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function ProjectsView({ data }: { data: ContentPanelProps["data"] }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [showDetail, setShowDetail] = useState(false)

    const projects = data.projects.length > 0
        ? data.projects
        : [
            {
                id: "mock-1",
                title: "Creating a Studio for Conversational AI Agents",
                client: "Parloa",
                year: "2024",
                description: "A comprehensive design system and studio environment for building complex AI agents.",
                imageUrl: null,
                link: null
            },
            {
                id: "mock-2",
                title: "Reimagining E-Commerce Checkout",
                client: "Shopify",
                year: "2023",
                description: "Streamlining the checkout process to increase conversion rates by 15%.",
                imageUrl: null,
                link: null
            },
            {
                id: "mock-3",
                title: "Financial Dashboard for Startups",
                client: "FinTech Co",
                year: "2022",
                description: "Visualizing complex financial data in an intuitive and actionable dashboard.",
                imageUrl: null,
                link: null
            }
        ]

    const nextProject = (e?: React.MouseEvent) => {
        e?.stopPropagation()
        setCurrentIndex((prev) => (prev + 1) % projects.length)
    }

    const prevProject = (e?: React.MouseEvent) => {
        e?.stopPropagation()
        setCurrentIndex((prev) => (prev - 1 + projects.length) % projects.length)
    }

    const currentProject = projects[currentIndex]

    return (
        <div className="h-full w-full relative bg-zinc-900 flex flex-col group">
            <div
                className="flex-1 relative overflow-hidden cursor-pointer"
                onClick={() => setShowDetail(true)}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center"
                    >
                        {currentProject.imageUrl ? (
                            <NextImage
                                src={currentProject.imageUrl}
                                alt={currentProject.title}
                                fill
                                className="object-cover opacity-50 transition-opacity duration-500 group-hover:opacity-70"
                                priority
                            />
                        ) : (
                            <div className="text-zinc-700 font-bold text-4xl opacity-20 select-none">
                                {currentProject.client || "Project"} Image
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

                <div className="absolute bottom-0 left-0 right-0 p-8 pb-24 sm:pb-12 flex flex-col justify-end h-full pointer-events-none">
                    <motion.div
                        key={currentProject.id}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="max-w-2xl space-y-4 pointer-events-auto"
                    >
                        <div className="flex items-center gap-3">
                            {currentProject.client && (
                                <Badge variant="outline" className="bg-white/10 text-white border-white/20 backdrop-blur-md">
                                    {currentProject.client}
                                </Badge>
                            )}
                            <span className="text-zinc-400 text-sm">{currentProject.year}</span>
                        </div>

                        <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight group-hover:text-purple-200 transition-colors">
                            {currentProject.title}
                        </h2>

                        <p className="text-zinc-300 text-lg line-clamp-2 max-w-xl">
                            {currentProject.description}
                        </p>

                        <div className="pt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-sm text-purple-300 font-medium">
                            <span>Click to view details</span>
                            <ArrowUp className="w-4 h-4 rotate-45" />
                        </div>
                    </motion.div>
                </div>
            </div>

            <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-20 pointer-events-none">
                <div className="flex flex-col items-center gap-2 bg-black/40 backdrop-blur-md p-1.5 rounded-full border border-white/10 pointer-events-auto">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={prevProject}
                        className="h-10 w-10 rounded-full hover:bg-white/20 text-white"
                    >
                        <ArrowUp className="h-5 w-5" />
                    </Button>
                    <span className="text-sm font-medium text-white/80 py-2 text-center rotate-180" style={{ writingMode: 'vertical-rl' }}>
                        {currentIndex + 1} / {projects.length}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={nextProject}
                        className="h-10 w-10 rounded-full hover:bg-white/20 text-white"
                    >
                        <ArrowDown className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            <AnimatePresence>
                {showDetail && (
                    <motion.div
                        initial={{ opacity: 0, y: "100%" }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: "100%" }}
                        className="absolute inset-0 z-30 bg-zinc-950 flex flex-col"
                    >
                        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                            <Button variant="ghost" onClick={() => setShowDetail(false)} className="gap-2 text-zinc-400 hover:text-white">
                                <ArrowUp className="w-4 h-4 -rotate-90" />
                                Back to Gallery
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="max-w-3xl mx-auto space-y-8 pb-20">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Badge variant="secondary" className="bg-purple-500/10 text-purple-300 border-purple-500/20">
                                            {currentProject.client}
                                        </Badge>
                                        <span className="text-zinc-500">{currentProject.year}</span>
                                    </div>
                                    <h1 className="text-4xl font-bold text-white">{currentProject.title}</h1>
                                </div>

                                <div className="aspect-video w-full relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                                    {currentProject.imageUrl ? (
                                        <NextImage
                                            src={currentProject.imageUrl}
                                            alt={currentProject.title}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-zinc-700">No Image</div>
                                    )}
                                </div>

                                <div className="prose prose-invert max-w-none">
                                    <p className="text-xl text-zinc-300 leading-relaxed">
                                        {currentProject.description}
                                    </p>
                                    {currentProject.link && (
                                        <a 
                                            href={currentProject.link} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 mt-4"
                                        >
                                            View Project <ArrowUp className="w-4 h-4 rotate-45" />
                                        </a>
                                    )}
                                </div>
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
        <div className="space-y-8">
            <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-32 h-32 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center">
                        <span className="text-4xl font-bold text-white/50">
                            {data.displayName.charAt(0)}
                        </span>
                    </div>
                </div>
                <div>
                    <h2 className="text-2xl font-bold">I&apos;m {data.displayName} :)</h2>
                    <p className="text-zinc-400">{data.headline || "Product Designer & Engineer"}</p>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold">About Me</h3>
                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {data.bio || "I like to build useful, beautiful software that feels good to use. I care a lot about the small details, but I also keep the big picture in mind. I love working on hard problems and turning ideas into products that actually make sense and bring joy."}
                </p>
            </div>
        </div>
    )
}

function ServicesView({ data, onBook }: { data: ContentPanelProps["data"]; onBook?: (serviceId: string) => void }) {
    const services = data.serviceOfferings.filter(s => s.isActive)

    if (services.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-zinc-500">No services available at the moment.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <p className="text-zinc-400 mb-6">
                Book a session with {data.displayName}. Choose from the available services below.
            </p>
            {services.map((service) => (
                <div 
                    key={service.id} 
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4 hover:border-zinc-700 transition-colors"
                >
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h3 className="text-xl font-semibold">{service.name}</h3>
                            {service.description && (
                                <p className="text-zinc-400 text-sm">{service.description}</p>
                            )}
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold">
                                {service.isFree ? "Free" : `$${(service.priceCents / 100).toFixed(0)}`}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-zinc-500">
                            <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                {service.durationMinutes} minutes
                            </span>
                        </div>
                        <Button 
                            onClick={() => onBook?.(service.id)}
                            className="bg-purple-600 hover:bg-purple-500"
                        >
                            <Calendar className="w-4 h-4 mr-2" />
                            Book Now
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}

function ProductsView({ data, onPurchase }: { data: ContentPanelProps["data"]; onPurchase?: (itemType: string, itemId: string) => void }) {
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
                            className="bg-purple-600 hover:bg-purple-500"
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
                                className="bg-purple-600 hover:bg-purple-500"
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
                            className="bg-purple-600 hover:bg-purple-500"
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
                            className="bg-purple-600 hover:bg-purple-500"
                        >
                            Join
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}
