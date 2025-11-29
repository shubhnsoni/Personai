"use client"

// import { UserButton } from "@clerk/nextjs"
import { ModeToggle } from "@/components/mode-toggle"

export function Header() {
    return (
        <header className="flex h-14 items-center gap-4 border-b bg-background px-6">
            <div className="flex-1">
                <h1 className="text-lg font-semibold">Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
                <ModeToggle />
                {/* <UserButton afterSignOutUrl="/" /> */}
                <div className="h-8 w-8 rounded-full bg-muted border flex items-center justify-center">
                    <span className="text-xs font-medium">MU</span>
                </div>
            </div>
        </header>
    )
}
