import { redirect } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { syncUser } from "@/lib/auth-sync"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await syncUser()

    if (!user) {
        // Should be handled by middleware, but just in case
        redirect("/sign-in")
    }

    // Check if user has a profile
    // If no profile, and NOT on onboarding page, redirect to onboarding
    // But wait, this layout wraps /dashboard/*
    // So if I am at /dashboard/overview, I should be redirected.
    // But /onboarding is NOT under /dashboard in my plan?
    // Plan: "Build /onboarding for first-time creators"
    // Task 3.2: "If a user has no profile and tries to visit /dashboard/*, redirect them to /onboarding."
    // So /onboarding is likely at root /onboarding, or /dashboard/onboarding?
    // Plan says "/onboarding".
    // So I redirect to /onboarding.

    if (user.profiles.length === 0) {
        redirect("/onboarding")
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar slug={user.profiles[0].slug} />
            <div className="flex flex-1 flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
