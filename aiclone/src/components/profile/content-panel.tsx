"use client"

import NextImage from "next/image"
import { X, Download, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"

interface ContentPanelProps {
    isOpen: boolean
    onClose: () => void
    type: "about" | "experience" | "projects" | null
    data: any
}

export function ContentPanel({ isOpen, onClose, type, data }: ContentPanelProps) {
    const mode = data.contentDisplayMode || "POPUP"

    const content = (
        <div className="flex-1 relative h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-zinc-800 bg-black/20 backdrop-blur-sm text-white">
                        <X className="h-5 w-5" />
                    </Button>
                    <h2 className="text-xl font-semibold capitalize text-white drop-shadow-md">{type}</h2>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2 rounded-full bg-black/20 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 hover:text-white">
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Download CV</span>
                    </Button>
                </div>
            </div>

            {/* Body */}
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
                            className="fixed inset-y-0 right-0 w-full lg:w-1/2 bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex flex-col"
                        >
                            {content}
                        </motion.div>
                    ) : (
                        // Popup Mode
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

function ExperienceView({ data }: { data: any }) {
    // Use real data if available, otherwise mock for demo/fallback
    const experiences = data.workExperiences && data.workExperiences.length > 0
        ? data.workExperiences
        : [
            {
                role: "Principal Product Designer",
                company: "Parloa",
                period: "2022–Present",
                description: "Leading design for AI conversational agents. Helped secure Series A, B, and C funding.",
                achievements: [
                    "Led design of two 0-1 products driving €20M+ revenue",
                    "Created company-wide design system",
                    "Hired and mentored 3 product designers"
                ]
            },
            {
                role: "Co-Founder & Lead Designer",
                company: "SomethingCreative",
                period: "2018–2022",
                description: "Founded a full-service design agency working with early-stage startups.",
                achievements: [
                    "Scaled agency to 15 employees",
                    "Delivered 50+ successful client projects",
                    "Won Awwwards Site of the Day"
                ]
            }
        ]

    return (
        <div className="space-y-12">
            {experiences.map((exp: any, i: number) => (
                <div key={i} className="relative pl-8 border-l border-zinc-800 space-y-4">
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-purple-500 ring-4 ring-zinc-950" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <h3 className="text-xl font-bold">{exp.role}</h3>
                            <div className="text-zinc-400 flex items-center gap-2">
                                <span className="font-medium text-zinc-300">{exp.company}</span>
                                <span>•</span>
                                <span>{exp.period || (exp.startDate + (exp.endDate ? ` - ${exp.endDate}` : " - Present"))}</span>
                            </div>
                        </div>
                        <Badge variant="secondary" className="w-fit bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                            {exp.company}
                        </Badge>
                    </div>

                    <p className="text-zinc-400 leading-relaxed">
                        {exp.description}
                    </p>

                    <div className="space-y-3">
                        {/* Only show achievements if it's an array (mock) or if we parse it from string (real) */}
                        {(Array.isArray(exp.achievements) || typeof exp.achievements === 'string') && (
                            <>
                                <h4 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Key Achievements</h4>
                                <ul className="space-y-2">
                                    {(Array.isArray(exp.achievements) ? exp.achievements : (exp.achievements ? [exp.achievements] : [])).map((achievement: string, j: number) => (
                                        <li key={j} className="flex items-start gap-3 text-zinc-300 text-sm">
                                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                                            {achievement}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

function ProjectsView({ data }: { data: any }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [showDetail, setShowDetail] = useState(false)

    const projects = data.projects && data.projects.length > 0
        ? data.projects
        : [
            {
                id: 1,
                title: "Creating a Studio for Conversational AI Agents",
                client: "Parloa",
                year: "2024",
                description: "A comprehensive design system and studio environment for building complex AI agents.",
                image: "/placeholder-project-1.jpg"
            },
            {
                id: 2,
                title: "Reimagining E-Commerce Checkout",
                client: "Shopify",
                year: "2023",
                description: "Streamlining the checkout process to increase conversion rates by 15%.",
                image: "/placeholder-project-2.jpg"
            },
            {
                id: 3,
                title: "Financial Dashboard for Startups",
                client: "FinTech Co",
                year: "2022",
                description: "Visualizing complex financial data in an intuitive and actionable dashboard.",
                image: "/placeholder-project-3.jpg"
            }
        ]

    const nextProject = (e?: any) => {
        e?.stopPropagation()
        setCurrentIndex((prev) => (prev + 1) % projects.length)
    }

    const prevProject = (e?: any) => {
        e?.stopPropagation()
        setCurrentIndex((prev) => (prev - 1 + projects.length) % projects.length)
    }

    const currentProject = projects[currentIndex]

    return (
        <div className="h-full w-full relative bg-zinc-900 flex flex-col group">
            {/* Main Image Area */}
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
                        {/* Use imageUrl if available, otherwise placeholder */}
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

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

                {/* Content Overlay */}
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

            {/* Navigation Controls - Left Center Vertical */}
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

            {/* Detailed View Modal (Nested) */}
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
                                    <p className="text-zinc-400">
                                        (More detailed project content would go here in a real implementation, fetched from the database or CMS.)
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function AboutView({ data }: { data: any }) {
    return (
        <div className="space-y-8">
            <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-32 h-32 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden">
                    {/* Placeholder for avatar */}
                    <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">I&apos;m {data.displayName} :)</h2>
                    <p className="text-zinc-400">{data.headline || "Product Designer & Engineer based in Berlin"}</p>
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
