"use client"

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Logo } from "@/components/brand/logo"
import { SidebarNav } from "./sidebar"

interface MobileSidebarProps {
    slug: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function MobileSidebar({ slug, open, onOpenChange }: MobileSidebarProps) {
    const handleLinkClick = () => {
        onOpenChange(false)
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="border-b p-0">
                    <div className="flex h-14 items-center px-4">
                        <SheetTitle className="sr-only">PersonaLink</SheetTitle>
                        <Logo />
                    </div>
                </SheetHeader>
                <div className="flex flex-col h-[calc(100%-3.5rem)]">
                    <SidebarNav slug={slug} onLinkClick={handleLinkClick} />
                </div>
            </SheetContent>
        </Sheet>
    )
}
