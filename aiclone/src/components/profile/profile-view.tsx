"use client"

import { useState } from "react"
import { ChatInterface } from "@/components/chat/chat-interface"
import { ContentPanel } from "@/components/profile/content-panel"
import { BookingModal } from "@/components/booking/booking-modal"
import { X, Calendar, DollarSign, Briefcase, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProfileViewProps {
    profile: {
        id: string
        displayName: string
        headline: string | null
        bio: string | null
        welcomeMessageOverride: string | null
        contentDisplayMode: string
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
    }
    animationConfig: { speed?: number; intensity?: number; colors?: string[] }
    colors: string[]
}

type ContentType = "about" | "experience" | "projects" | "services" | null

export function ProfileView({ profile, animationConfig, colors }: ProfileViewProps) {
    const [activeContent, setActiveContent] = useState<ContentType>(null)
    const [isBookingOpen, setIsBookingOpen] = useState(false)
    const [selectedService, setSelectedService] = useState<string | null>(null)

    const handleShowContent = (type: "about" | "experience" | "projects") => {
        setActiveContent(type)
    }

    const handleBookService = (serviceId: string) => {
        setSelectedService(serviceId)
        setIsBookingOpen(true)
    }

    const activeServices = profile.serviceOfferings.filter(s => s.isActive)

    return (
        <div className="flex h-screen w-full bg-black text-foreground overflow-hidden relative">
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
                <div className="flex-1 w-full mx-auto relative">
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

                    {!activeContent && (
                        <div className="absolute bottom-28 left-4 right-4 flex flex-wrap justify-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                            <QuickActionChip 
                                icon={<User className="w-3.5 h-3.5" />}
                                label="About"
                                onClick={() => setActiveContent("about")}
                            />
                            <QuickActionChip 
                                icon={<Briefcase className="w-3.5 h-3.5" />}
                                label="Experience"
                                onClick={() => setActiveContent("experience")}
                            />
                            {activeServices.length > 0 && (
                                <QuickActionChip 
                                    icon={<DollarSign className="w-3.5 h-3.5" />}
                                    label="Services"
                                    onClick={() => setActiveContent("services")}
                                />
                            )}
                            <QuickActionChip 
                                icon={<Calendar className="w-3.5 h-3.5" />}
                                label="Book a Call"
                                onClick={() => setIsBookingOpen(true)}
                                highlighted
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
                "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all hover:scale-105 shadow-lg backdrop-blur-sm",
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
