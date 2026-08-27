"use client"

import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"

export default function BusinessOsError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <div className="flex-1">
            <ErrorState
                title="Business OS could not load"
                description={
                    error.message
                        ? `A blueprint failed to load: ${error.message}`
                        : "A blueprint failed to load."
                }
                action={<Button onClick={reset}>Try again</Button>}
            />
        </div>
    )
}
