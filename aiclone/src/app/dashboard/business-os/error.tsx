"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"

/**
 * This boundary only ever catches unexpected render/runtime errors on the
 * Business OS route. Access-control denials never reach it: `requireSurface`
 * redirects server-side before this tree mounts, and API-level 401/403s are
 * handled by their own callers. So there is no basis here for guessing at a
 * permissions cause (or any other specific cause) — we can only report that
 * something broke while rendering, plus whatever the error itself told us.
 */
export default function BusinessOsError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("Business OS route error:", error)
    }, [error])

    return (
        <div className="flex-1">
            <ErrorState
                title="Business OS hit an unexpected error"
                description={
                    <div className="space-y-1">
                        <p>Something went wrong while rendering this page. This is not necessarily a permissions issue.</p>
                        {error.message ? (
                            <p className="font-mono text-xs break-words">{error.message}</p>
                        ) : null}
                        {error.digest ? (
                            <p className="text-xs">Reference: {error.digest}</p>
                        ) : null}
                    </div>
                }
                action={<Button onClick={reset}>Try again</Button>}
            />
        </div>
    )
}
