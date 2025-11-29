"use client"

import { useState } from "react"
import { ChatInterface } from "@/components/chat/chat-interface"
import { ContentPanel } from "@/components/profile/content-panel"
import { WelcomeOrb } from "@/components/welcome-orb"
import { Button } from "@/components/ui/button"
import { BookingModal } from "@/components/booking/booking-modal"

interface ProfileViewProps {
    profile: any
    animationConfig: any
    colors: string[]
}

export function ProfileView({ profile, animationConfig, colors }: ProfileViewProps) {
    const [activeContent, setActiveContent] = useState<"about" | "experience" | "projects" | null>(null)

    const handleShowContent = (type: "about" | "experience" | "projects") => {
        setActiveContent(type)
    }

    return (
        <div className="flex h-screen w-full bg-black text-foreground overflow-hidden relative">
            {/* Background Gradient */}
            <div
                className="absolute inset-0 opacity-10 pointer-events-none z-0"
                style={{
                    background: `radial-gradient(circle at 50% 50%, ${colors[0]}, transparent 70%)`
                }}
            />

            {/* Main Chat Area - Left Side (or Full Width) */}
            <div className={`flex-1 flex flex-col h-full relative z-10 transition-all duration-500 ease-in-out ${activeContent ? 'lg:w-1/2 lg:flex-none' : 'w-full'}`}>
                <div className="flex-1 w-full mx-auto">
                    <ChatInterface
                        profile={profile}
                        colors={colors}
                        animationConfig={animationConfig}
                        onShowContent={handleShowContent}
                        isPanelOpen={!!activeContent}
                        quickQuestions={[
                            `Show me ${profile.displayName}'s work history`,
                            `Show me ${profile.displayName}'s design projects`,
                            `Who is ${profile.displayName}?`,
                            "Book a call"
                        ]}
                    />
                </div>
            </div>

            {/* Content Panel - Right Side (Overlay or Split) */}
            <ContentPanel
                isOpen={!!activeContent}
                onClose={() => setActiveContent(null)}
                type={activeContent}
                data={profile}
            />
        </div>
    )
}
