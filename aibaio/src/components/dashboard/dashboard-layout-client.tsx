"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar"

interface DashboardLayoutClientProps {
    children: React.ReactNode
    slug: string
}

export function DashboardLayoutClient({ children, slug }: DashboardLayoutClientProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar slug={slug} />
            <MobileSidebar
                slug={slug}
                open={mobileMenuOpen}
                onOpenChange={setMobileMenuOpen}
            />
            <div className="flex flex-1 flex-col overflow-hidden">
                <Header onMenuClick={() => setMobileMenuOpen(true)} />
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
