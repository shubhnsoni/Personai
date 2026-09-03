"use client"

import Link from "next/link"
import { useEffect, useState, useSyncExternalStore } from "react"
import { usePathname, useRouter } from "next/navigation"
import { SignIn, SignUp } from "@clerk/nextjs"
import { AnimatePresence, motion } from "framer-motion"
import { Logo } from "@/components/brand/logo"
import { clerkAppearance } from "@/lib/clerk-appearance"

/**
 * Clerk's <SignIn>/<SignUp> host (`data-clerk-component`) is inserted on the
 * first client render and omitted from SSR HTML. Reading `typeof window`
 * during render is the mismatch Next logged on /sign-in.
 *
 * useSyncExternalStore keeps the server snapshot and the hydration frame
 * identical (no Clerk host), then the client snapshot mounts the widgets.
 * A client-only mount skips the placeholder and shows Clerk immediately.
 */
const subscribeNever = () => () => {}
function useIsClient() {
    return useSyncExternalStore(subscribeNever, () => true, () => false)
}

type Mode = "sign-in" | "sign-up"

const copy = {
    "sign-in": {
        title: "Welcome back",
        subtitle: "Sign in to your account",
        altHint: "Don't have an account?",
        altLabel: "Sign up",
    },
    "sign-up": {
        title: "Create account",
        subtitle: "Sign up to get started",
        altHint: "Already have an account?",
        altLabel: "Sign in",
    },
} as const

function modeFromPath(pathname: string): Mode {
    return pathname.startsWith("/sign-up") ? "sign-up" : "sign-in"
}

export function AuthScreen() {
    const pathname = usePathname()
    const router = useRouter()
    const routeMode = modeFromPath(pathname)
    const [mode, setMode] = useState<Mode>(routeMode)
    const clerkReady = useIsClient()

    useEffect(() => {
        setMode(routeMode)
    }, [routeMode])

    useEffect(() => {
        router.prefetch("/sign-in")
        router.prefetch("/sign-up")
    }, [router])

    function go(next: Mode) {
        if (next === mode) return
        setMode(next)
        router.replace(next === "sign-up" ? "/sign-up" : "/sign-in", { scroll: false })
    }

    const current = copy[mode]

    return (
        <div className="auth-scene relative min-h-dvh overflow-hidden text-white">
            <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 pt-[max(0.9rem,env(safe-area-inset-top))]">
                <Logo className="from-white to-white/70" />
                <Link href="/" className="text-sm text-white/35 hover:text-white">
                    Home
                </Link>
            </header>

            <main className="relative z-10 flex min-h-dvh items-center justify-center px-6 py-[max(4.5rem,env(safe-area-inset-top))]">
                <div className="auth-glass w-full max-w-[21rem] px-7 py-8">
                    <div className="relative z-10">
                        <div className="mb-6 flex min-h-[4.25rem] flex-col items-center text-center">
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                    key={mode}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                >
                                    <h1 className="text-[1.55rem] font-medium tracking-[-0.03em] text-white">
                                        {current.title}
                                    </h1>
                                    <p className="mt-1.5 text-[13px] text-white/38">{current.subtitle}</p>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <div className="auth-clerk relative w-full">
                            {clerkReady ? (
                                <>
                                    <div
                                        className={mode === "sign-in" ? "block" : "hidden"}
                                        aria-hidden={mode !== "sign-in"}
                                    >
                                        <SignIn
                                            appearance={clerkAppearance}
                                            fallbackRedirectUrl="/dashboard"
                                            signUpUrl="/sign-up"
                                        />
                                    </div>
                                    <div
                                        className={mode === "sign-up" ? "block" : "hidden"}
                                        aria-hidden={mode !== "sign-up"}
                                    >
                                        <SignUp
                                            appearance={clerkAppearance}
                                            fallbackRedirectUrl="/onboarding"
                                            signInUrl="/sign-in"
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="min-h-[14rem]" aria-hidden />
                            )}
                        </div>

                        <p className="mt-6 text-center text-[12px] text-white/35">
                            {current.altHint}{" "}
                            <button
                                type="button"
                                onClick={() => go(mode === "sign-in" ? "sign-up" : "sign-in")}
                                className="font-medium text-[#00D7FF] hover:text-white"
                            >
                                {current.altLabel}
                            </button>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
