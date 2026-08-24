"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

function canHover() {
    return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches
}

export type DockTab = {
    id: string
    label: string
    icon: ReactNode
    href?: string
    target?: string
    onClick?: () => void
}

export function DockTabs({ tabs, value }: { tabs: DockTab[]; value?: string }) {
    const [active, setActive] = useState<string | null>(null)
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!active) return
        const onDown = (e: PointerEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setActive(null)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setActive(null)
        }
        document.addEventListener("pointerdown", onDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("pointerdown", onDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [active])

    return (
        <div
            ref={rootRef}
            className="flex min-w-0 items-center rounded-full border border-border/70 bg-background/80 p-0.5"
            onMouseLeave={() => {
                if (canHover()) setActive(null)
            }}
        >
            {tabs.map((tab) => {
                const selected = value === tab.id
                const expanded = (active ?? value) === tab.id
                const className = cn(
                    "inline-flex h-8 shrink-0 items-center rounded-full px-2 text-muted-foreground transition-colors",
                    selected ? "bg-foreground text-background" : active === tab.id ? "bg-muted" : "hover:bg-muted"
                )
                const inner = (
                    <>
                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
                            {tab.icon}
                        </span>
                        <span
                            className={cn(
                                "overflow-hidden whitespace-nowrap text-xs font-medium transition-[max-width,margin,opacity] duration-200",
                                expanded ? "ml-1.5 max-w-[5.5rem] opacity-100" : "max-w-0 opacity-0"
                            )}
                        >
                            {tab.label}
                        </span>
                    </>
                )
                const bind = {
                    onMouseEnter: () => {
                        if (canHover()) setActive(tab.id)
                    },
                    onPointerDown: () => {
                        if (!canHover()) setActive(tab.id)
                    },
                }
                if (tab.href) {
                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            target={tab.target}
                            aria-label={tab.label}
                            className={className}
                            {...bind}
                        >
                            {inner}
                        </Link>
                    )
                }
                return (
                    <button
                        key={tab.id}
                        type="button"
                        aria-label={tab.label}
                        className={className}
                        {...bind}
                        onClick={tab.onClick}
                    >
                        {inner}
                    </button>
                )
            })}
        </div>
    )
}
