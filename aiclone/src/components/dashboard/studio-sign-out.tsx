"use client"

import { useState } from "react"
import { useClerk } from "@clerk/nextjs"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

export function StudioSignOut({
    className,
    compact = false,
}: {
    className?: string
    compact?: boolean
}) {
    const { signOut } = useClerk()
    const [busy, setBusy] = useState(false)

    return (
        <button
            type="button"
            disabled={busy}
            onClick={async () => {
                setBusy(true)
                try {
                    await signOut({ redirectUrl: "/sign-in" })
                } finally {
                    setBusy(false)
                }
            }}
            className={cn(
                "inline-flex items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60",
                compact
                    ? "h-8 w-8 rounded-full hover:bg-accent"
                    : "h-10 w-full rounded-xl px-3 hover:bg-accent",
                className
            )}
            aria-label="Sign out"
        >
            <LogOut className="h-4 w-4" />
            {compact ? null : <span>{busy ? "Signing out…" : "Sign out"}</span>}
        </button>
    )
}
