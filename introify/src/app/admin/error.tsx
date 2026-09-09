"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("Admin error:", error)
    }, [error])

    return (
        <div className="flex min-h-[40vh] items-center justify-center">
            <div className="max-w-md space-y-3 text-center">
                <h2 className="text-xl font-semibold tracking-tight">Could not load this page</h2>
                <p className="text-sm text-muted-foreground">Try again. If it keeps failing, check Capacity.</p>
                <Button onClick={reset}>Try again</Button>
            </div>
        </div>
    )
}
