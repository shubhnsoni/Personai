"use client"

import { Menu } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"

interface HeaderProps {
    onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
    return (
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
            <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={onMenuClick}
                aria-label="Toggle menu"
            >
                <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1">
                <h1 className="text-lg font-semibold">Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
                <ModeToggle />
                <div className="h-8 w-8 rounded-full bg-muted border flex items-center justify-center">
                    <span className="text-xs font-medium">MU</span>
                </div>
            </div>
        </header>
    )
}
