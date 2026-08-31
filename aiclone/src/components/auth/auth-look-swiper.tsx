"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { AuthShell } from "@/components/auth/auth-shell"
import { AUTH_LOOKS, isAuthLook, type AuthLookId } from "@/lib/auth-looks"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "pl-auth-look"

function readRequestedLookIndex(): number {
    if (typeof window === "undefined") return 0
    const fromUrl = new URLSearchParams(window.location.search).get("look")
    const saved = (() => {
        try {
            return sessionStorage.getItem(STORAGE_KEY)
        } catch {
            return null
        }
    })()
    const wanted = isAuthLook(fromUrl) ? fromUrl : isAuthLook(saved) ? saved : null
    if (!wanted) return 0
    const index = AUTH_LOOKS.findIndex((look) => look.id === wanted)
    return index >= 0 ? index : 0
}

// The request is read once after hydration. getServerSnapshot keeps the server and first client frame
// identical; React then reads the browser snapshot without a synchronous setState inside an effect.
const subscribeRequestedLook = () => () => undefined

export function AuthLookSwiper({
    title,
    subtitle,
    altHref,
    altLabel,
    children,
}: {
    title: string
    subtitle?: string
    altHref?: string
    altLabel?: string
    children: ReactNode
}) {
    const requestedIndex = useSyncExternalStore(subscribeRequestedLook, readRequestedLookIndex, () => 0)
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const index = selectedIndex ?? requestedIndex
    const startX = useRef<number | null>(null)

    const go = (next: number) => {
        const i = (next + AUTH_LOOKS.length) % AUTH_LOOKS.length
        setSelectedIndex(i)
        try {
            sessionStorage.setItem(STORAGE_KEY, AUTH_LOOKS[i].id)
        } catch { /* ignore */ }
    }

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "ArrowRight") go(index + 1)
            if (event.key === "ArrowLeft") go(index - 1)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [index])

    const look = AUTH_LOOKS[index].id as AuthLookId

    return (
        <div
            className="relative"
            onTouchStart={(event) => {
                startX.current = event.touches[0]?.clientX ?? null
            }}
            onTouchEnd={(event) => {
                if (startX.current == null) return
                const dx = (event.changedTouches[0]?.clientX ?? startX.current) - startX.current
                startX.current = null
                if (dx < -48) go(index + 1)
                if (dx > 48) go(index - 1)
            }}
        >
            <AuthShell look={look} title={title} subtitle={subtitle} altHref={altHref} altLabel={altLabel}>
                {children}
            </AuthShell>

            <div className="pointer-events-none absolute inset-x-0 top-[3.15rem] z-20 flex flex-col items-center gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    {index + 1} / {AUTH_LOOKS.length} · {AUTH_LOOKS[index].name}
                </p>
                <div className="pointer-events-auto flex items-center gap-1.5">
                    {AUTH_LOOKS.map((item, i) => (
                        <button
                            key={item.id}
                            type="button"
                            aria-label={item.name}
                            onClick={() => go(i)}
                            className={cn(
                                "h-1.5 rounded-full transition-all",
                                i === index ? "w-5 bg-cyan-300" : "w-1.5 bg-white/25"
                            )}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
