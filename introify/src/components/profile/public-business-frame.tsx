"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { PublicBrowserTheme } from "@/components/profile/public-browser-theme"
import { visualKeyboardOpen } from "@/lib/visual-keyboard"
import { cn } from "@/lib/utils"
import "@/components/profile/public-business-frame.css"

/** The chat and its footer share one viewport; linked catalogues retain normal page scrolling. */
export function PublicBusinessFrame({ children, profilePath, theme }: {
    children: ReactNode
    profilePath: string
    theme: string
}) {
    const pathname = usePathname()
    const isProfile = pathname?.replace(/\/$/, "") === profilePath
    const isBusiness = isProfile || Boolean(pathname?.startsWith(`${profilePath}/`))
    const frameRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const frame = frameRef.current
        const viewport = window.visualViewport
        if (!isProfile || !frame || !viewport) return

        const resize = () => {
            if (visualKeyboardOpen()) frame.setAttribute("data-keyboard", "")
            else frame.removeAttribute("data-keyboard")
            // Pinch zoom should magnify the page, not resize its layout.
            if (viewport.scale !== 1) return
            frame.style.height = `${Math.round(viewport.height)}px`
        }
        resize()
        viewport.addEventListener("resize", resize)
        window.addEventListener("resize", resize)
        return () => {
            viewport.removeEventListener("resize", resize)
            window.removeEventListener("resize", resize)
            frame.style.removeProperty("height")
            frame.removeAttribute("data-keyboard")
        }
    }, [isProfile])

    return (
        <div
            ref={frameRef}
            data-public-business-theme={theme}
            data-public-browser-theme={isBusiness ? theme : undefined}
            data-profile-viewport={isProfile ? "" : undefined}
            className={cn(isBusiness && "bg-profile", isProfile && "flex h-dvh min-h-0 w-full flex-col overflow-hidden")}
        >
            <PublicBrowserTheme active={isBusiness} theme={theme} frameRef={frameRef} />
            {children}
        </div>
    )
}
