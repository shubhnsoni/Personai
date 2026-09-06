"use client"

import { useEffect, useState } from "react"
import { ReviewForm } from "@/components/shop/review-form"

export function PdpReviewPanel({ productId }: { productId: string }) {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const show = () => {
            if (window.location.hash === "#leave-review") setOpen(true)
        }
        show()
        window.addEventListener("hashchange", show)
        return () => window.removeEventListener("hashchange", show)
    }, [])

    if (!open) return <div id="leave-review" />

    return (
        <div id="leave-review" className="pdp-review-form">
            <ReviewForm productId={productId} tone="light" />
        </div>
    )
}
