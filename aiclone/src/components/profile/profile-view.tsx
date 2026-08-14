"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { ChatInterface, type ChatChip } from "@/components/chat/chat-interface"
import { ContentPanel } from "@/components/profile/content-panel"
import { BookingModal } from "@/components/booking/booking-modal"
import { X, Calendar, DollarSign, User, CheckCircle, Briefcase, FolderKanban, Gift, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface ProfileViewProps {
    profile: {
        id: string
        slug: string
        displayName: string
        headline: string | null
        bio: string | null
        welcomeMessageOverride: string | null
        contentDisplayMode: string
        primaryGoal?: string | null
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
        leadMagnets?: Array<{
            id: string
            title: string
        }>
    }
    animationConfig: { speed?: number; intensity?: number; colors?: string[] }
    colors: string[]
}

type ContentType = "about" | "experience" | "projects" | "services" | "products" | "courses" | "events" | "communities" | null

type ChipDef = ChatChip & { available: boolean }

export function ProfileView({ profile, animationConfig, colors }: ProfileViewProps) {
    const [activeContent, setActiveContent] = useState<ContentType>(null)
    const [isBookingOpen, setIsBookingOpen] = useState(false)
    const [selectedService, setSelectedService] = useState<string | null>(null)
    const [isPurchasing, setIsPurchasing] = useState(false)
    const [showSuccessNotification, setShowSuccessNotification] = useState(false)
    const searchParams = useSearchParams()

    useEffect(() => {
        const checkoutStatus = searchParams.get('checkout')
        if (checkoutStatus === 'success') {
            setShowSuccessNotification(true)
            const timer = setTimeout(() => {
                setShowSuccessNotification(false)
                window.history.replaceState({}, '', `/${profile.slug}`)
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [searchParams, profile.slug])

    const handleShowContent = (type: "about" | "experience" | "projects" | "products" | "courses" | "events" | "communities") => {
        setActiveContent(type)
    }

    const handleBookService = (serviceId: string) => {
        setSelectedService(serviceId)
        setIsBookingOpen(true)
    }

    const stripeEnabled = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

    const handlePurchase = async (itemType: string, itemId: string) => {
        if (isPurchasing) return
        if (!stripeEnabled) {
            toast.error("Purchases coming soon!", { description: "Payment processing hasn't been set up yet." })
            return
        }

        try {
            setIsPurchasing(true)
            const response = await fetch('/api/stripe/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    itemType,
                    itemId,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create checkout session')
            }

            if (data.url) {
                window.location.href = data.url
            } else if (data.redirectUrl) {
                window.location.href = data.redirectUrl
            }
        } catch (error) {
            console.error('Purchase error:', error)
            alert('Failed to process purchase. Please try again.')
        } finally {
            setIsPurchasing(false)
        }
    }

    const chips = buildGoalChips(profile, {
        openBooking: () => setIsBookingOpen(true),
        openContent: (type) => setActiveContent(type),
    })

    return (
        <div className="dark flex h-screen w-full bg-profile text-profile-text overflow-hidden relative">
            {showSuccessNotification && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-3 px-4 py-3 bg-green-600/90 text-white rounded-lg shadow-lg backdrop-blur-sm border border-green-500/30">
                        <CheckCircle className="w-5 h-5 flex-shrink-0" />
                        <div>
                            <p className="font-medium">Purchase successful!</p>
                            <p className="text-sm text-green-100">Thank you for your order. Check your email for details.</p>
                        </div>
                        <button
                            onClick={() => setShowSuccessNotification(false)}
                            className="ml-2 p-1 hover:bg-green-500/50 rounded transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <div
                className="absolute inset-0 opacity-10 pointer-events-none z-0"
                style={{
                    background: `radial-gradient(circle at 30% 30%, ${colors[0]}, transparent 60%), radial-gradient(circle at 70% 70%, ${colors[1] || colors[0]}, transparent 60%)`
                }}
            />

            <div className={cn(
                "flex-1 flex flex-col h-full relative z-10 transition-all duration-500 ease-in-out",
                activeContent ? "lg:w-[40%] lg:flex-none" : "w-full"
            )}>
                <div className="flex-1 w-full mx-auto relative h-full overflow-hidden">
                    <ChatInterface
                        profile={profile}
                        colors={colors}
                        animationConfig={animationConfig}
                        onShowContent={handleShowContent}
                        isPanelOpen={!!activeContent}
                        chips={chips}
                    />
                </div>
            </div>

            <ContentPanel
                isOpen={!!activeContent}
                onClose={() => setActiveContent(null)}
                type={activeContent}
                data={profile}
                onBookService={handleBookService}
                onPurchase={handlePurchase}
            />

            <BookingModal
                isOpen={isBookingOpen}
                onClose={() => {
                    setIsBookingOpen(false)
                    setSelectedService(null)
                }}
                profile={profile}
                selectedServiceId={selectedService}
            />
        </div>
    )
}

function buildGoalChips(
    profile: ProfileViewProps["profile"],
    actions: {
        openBooking: () => void
        openContent: (type: Exclude<ContentType, null>) => void
    }
): ChatChip[] {
    const name = profile.displayName
    const hasServices = profile.serviceOfferings.some(s => s.isActive)
    const hasProjects = profile.projects.length > 0
    const hasExperience = profile.workExperiences.length > 0
    const hasWork = hasProjects || hasExperience
    const hasLeadMagnets = (profile.leadMagnets?.length ?? 0) > 0

    const catalog: Record<string, ChipDef> = {
        book: {
            id: "book",
            label: "Book a call",
            available: hasServices,
            icon: <Calendar className="w-3.5 h-3.5" />,
            onSelect: actions.openBooking,
        },
        services: {
            id: "services",
            label: "See services",
            available: hasServices,
            icon: <DollarSign className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("services"),
        },
        rates: {
            id: "rates",
            label: "Ask about rates",
            available: hasServices,
            icon: <DollarSign className="w-3.5 h-3.5" />,
            prompt: `What are ${name}'s rates?`,
        },
        work: {
            id: "work",
            label: "See work",
            available: hasWork,
            icon: <Briefcase className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent(hasProjects ? "projects" : "experience"),
        },
        portfolio: {
            id: "portfolio",
            label: "See portfolio",
            available: hasProjects,
            icon: <FolderKanban className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("projects"),
        },
        history: {
            id: "history",
            label: "Work history",
            available: hasExperience,
            icon: <Briefcase className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("experience"),
        },
        projects: {
            id: "projects",
            label: "See projects",
            available: hasProjects,
            icon: <FolderKanban className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("projects"),
        },
        cases: {
            id: "cases",
            label: "Case studies",
            available: hasProjects,
            icon: <FolderKanban className="w-3.5 h-3.5" />,
            prompt: "Walk me through a case study",
        },
        about: {
            id: "about",
            label: "About",
            available: true,
            icon: <User className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("about"),
        },
        guide: {
            id: "guide",
            label: "Get the free guide",
            available: hasLeadMagnets,
            icon: <Gift className="w-3.5 h-3.5" />,
            prompt: "How can I get the free guide?",
        },
        ask: {
            id: "ask",
            label: "Ask a question",
            available: true,
            icon: <MessageCircle className="w-3.5 h-3.5" />,
        },
    }

    const orderByGoal: Record<string, string[]> = {
        BOOK_CALL: ["book", "services", "rates", "work"],
        HIRE_ME: ["portfolio", "history", "rates", "book"],
        SHOW_PORTFOLIO: ["projects", "cases", "about", "book"],
        SHOWCASE_WORK: ["projects", "cases", "about", "book"],
        COLLECT_LEADS: ["guide", "ask", "work", "book"],
    }

    const goal = profile.primaryGoal || "BOOK_CALL"
    const keys = orderByGoal[goal] ?? ["about", "work", "services", "book"]
    const chips = keys
        .map((key) => catalog[key])
        .filter((chip): chip is ChipDef => Boolean(chip?.available))
        .map(({ available: _available, ...chip }) => chip)

    if (chips.length === 0) {
        const { available: _available, ...about } = catalog.about
        chips.push(about)
    }
    if (chips[0]) chips[0] = { ...chips[0], highlighted: true }
    return chips
}
