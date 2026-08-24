"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { confirmProductOrder } from "@/app/actions/products"

export function ConfirmOrderButton({ purchaseId }: { purchaseId: string }) {
    const [busy, setBusy] = useState(false)
    const router = useRouter()
    return (
        <Button
            size="sm"
            className="mt-2 h-7 rounded-full"
            disabled={busy}
            onClick={async () => {
                setBusy(true)
                try {
                    await confirmProductOrder(purchaseId)
                    router.refresh()
                } finally {
                    setBusy(false)
                }
            }}
        >
            {busy ? "..." : "Confirm paid"}
        </Button>
    )
}
