"use client"

import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import { parseContentDisplayMode } from "@/lib/content-display"
import { bottomDrawerPanelClassName, bottomDrawerShellClassName } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/**
 * plat-p1-2: the stage panel is a dark surface (bg-zinc-950). Scope the dark theme tokens to it
 * (`dark` + `text-foreground`) so token-based children (Label, Input, Button, headings that inherit
 * color) never render light-theme ink (dark slate) on the near-black panel.
 * `surface="theme"` keeps a panel that paints its own theme background (checkout) on page tokens.
 */
export type ProfileStageSurface = "dark" | "theme"

export const PROFILE_STAGE_DARK_SURFACE_CLASS = "dark text-foreground"

/** Shared ✕ for every ProfileStage panel — always has an accessible name. */
export function ProfileStageClose({
    onClose,
    className,
    iconClassName = "h-4 w-4",
    label = "Close",
}: {
    onClose: () => void
    className?: string
    iconClassName?: string
    label?: string
}) {
    return (
        <button
            type="button"
            onClick={onClose}
            aria-label={label}
            title={label}
            data-stage-close=""
            className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", className)}
        >
            <X className={iconClassName} aria-hidden />
        </button>
    )
}

export function ProfileStage({
    open,
    onClose,
    mode,
    forcePopup,
    zClass = "z-50",
    surface = "dark",
    className,
    children,
}: {
    open: boolean
    onClose: () => void
    mode?: string | null
    forcePopup?: boolean
    zClass?: string
    surface?: ProfileStageSurface
    className?: string
    children: React.ReactNode
}) {
    const sidebar = !forcePopup && parseContentDisplayMode(mode) === "SIDE_PANEL"

    useEffect(() => {
        if (!open) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open, onClose])

    return (
        <AnimatePresence>
            {open ? (
                <>
                    <motion.div
                        key="backdrop"
                        data-content-backdrop=""
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className={cn(
                            "fixed inset-0 bg-black/70 backdrop-blur-sm",
                            zClass,
                            sidebar && "md:hidden",
                        )}
                    />
                    <div
                        data-content-stage=""
                        data-desktop-surface={sidebar ? "sidebar" : "popup"}
                        role={sidebar ? "complementary" : "dialog"}
                        aria-modal={sidebar ? undefined : true}
                        className={cn(
                            "fixed inset-0",
                            bottomDrawerShellClassName,
                            zClass,
                            sidebar &&
                                "md:static md:inset-auto md:h-full md:w-[min(56%,42rem)] md:min-w-[22rem] md:items-stretch md:justify-stretch md:p-0",
                        )}
                    >
                        <motion.div
                            key="stage"
                            data-stage-surface={surface}
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 24 }}
                            className={cn(
                                "relative flex w-full flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-zinc-950 shadow-2xl",
                                surface === "dark" && PROFILE_STAGE_DARK_SURFACE_CLASS,
                                bottomDrawerPanelClassName,
                                !sidebar && "md:max-h-[min(80dvh,40rem)] md:max-w-lg md:rounded-2xl md:border",
                                sidebar &&
                                    "md:h-full md:max-h-none md:max-w-none md:rounded-none md:border-0 md:border-l md:border-white/10 md:shadow-none",
                                className,
                            )}
                        >
                            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20 md:hidden" aria-hidden />
                            {children}
                        </motion.div>
                    </div>
                </>
            ) : null}
        </AnimatePresence>
    )
}
