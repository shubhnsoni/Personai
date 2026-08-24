"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { resendLibraryLink } from "@/app/actions/library"
import { toast } from "sonner"

export function ResendLibraryLink({ email }: { email: string }) {
    const [busy, setBusy] = useState(false)
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={busy}
            onClick={async () => {
                setBusy(true)
                try {
                    await resendLibraryLink(email)
                    toast.success(`Library link sent to ${email}`)
                } catch {
                    toast.error("Could not send link")
                } finally {
                    setBusy(false)
                }
            }}
        >
            {busy ? "..." : "Resend library"}
        </Button>
    )
}
