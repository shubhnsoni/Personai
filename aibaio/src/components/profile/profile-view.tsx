"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { ChatInterface } from "@/components/chat/chat-interface"
import { ContentPanel } from "@/components/profile/content-panel"
import { BookingModal } from "@/components/booking/booking-modal"
import { X, Calendar, DollarSign, User, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProfileViewProps {
    profile: {
        id: string
        slug: string
        displayName: string
        headline: string | null
        bio: string | null
        welcomeMessageOverride: string | null
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
    animationConfig: { speed?: number; intensity?: number; colors?: string[] }
    colors: string[]
}

type ContentType = "about" | "experience" | "projects" | "services" | "products" | "courses" | "events" | "communities" | null

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

    const handlePurchase = async (itemType: string, itemId: string) => {
        if (isPurchasing) return

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

    const activeServices = profile.serviceOfferings.filter(s => s.isActive)

    return (
        <div className="flex h-screen w-full bg-black text-foreground overflow-hidden relative">
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
                {!activeContent && (
                    <div className="absolute top-4 right-4 z-30 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
                        <QuickActionChip
                            icon={<User className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                            label="About"
                            onClick={() => setActiveContent("about")}
                        />
                        <QuickActionChip
                            icon={<Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                            label="Book"
                            onClick={() => setIsBookingOpen(true)}
                            highlighted
                        />
                    </div>
                )}

                <div className="flex-1 w-full mx-auto relative h-full overflow-hidden">
                    <ChatInterface
                        profile={profile}
                        colors={colors}
                        animationConfig={animationConfig}
                        onShowContent={handleShowContent}
                        isPanelOpen={!!activeContent}
                        quickQuestions={[
                            `Show me ${profile.displayName}'s work history`,
                            `Show me ${profile.displayName}'s projects`,
                            `What services does ${profile.displayName} offer?`,
                            "Book a call"
                        ]}
                    />

                    {!activeContent && activeServices.length > 0 && (
                        <div className="absolute bottom-28 left-2 right-2 sm:left-4 sm:right-4 flex flex-wrap justify-center gap-1.5 sm:gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                            <QuickActionChip
                                icon={<DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                                label="Services"
                                onClick={() => setActiveContent("services")}
                            />
                        </div>
                    )}
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

interface QuickActionChipProps {
    icon: React.ReactNode
    label: string
    onClick: () => void
    highlighted?: boolean
}

function QuickActionChip({ icon, label, onClick, highlighted }: QuickActionChipProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-[11px] sm:text-xs font-medium transition-all active:scale-95 hover:scale-105 shadow-lg backdrop-blur-sm touch-manipulation",
                highlighted
                    ? "bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/30"
                    : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/50"
            )}
        >
            {icon}
            {label}
        </button>
    )
}
