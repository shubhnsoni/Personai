"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { confirmProductOrder, rejectProductOrder } from "@/app/actions/products"

export function ConfirmOrderButton({ purchaseId, showReject }: { purchaseId: string; showReject?: boolean }) {
    const [busy, setBusy] = useState<"ok" | "no" | null>(null)
    const router = useRouter()
    return (
        <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            <Button
                size="sm"
                className="h-7 rounded-full"
                disabled={!!busy}
                onClick={async () => {
                    setBusy("ok")
                    try {
                        await confirmProductOrder(purchaseId)
                        router.refresh()
                    } finally {
                        setBusy(null)
                    }
                }}
            >
                {busy === "ok" ? "..." : "Approve"}
            </Button>
            {showReject ? (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-full"
                    disabled={!!busy}
                    onClick={async () => {
                        setBusy("no")
                        try {
                            await rejectProductOrder(purchaseId)
                            router.refresh()
                        } finally {
                            setBusy(null)
                        }
                    }}
                >
                    {busy === "no" ? "..." : "Reject"}
                </Button>
            ) : null}
        </div>
    )
}
