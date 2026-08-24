"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckoutSheet, type CheckoutItem } from "@/components/checkout/checkout-sheet"
import { useMoney } from "@/components/pricing-provider"

export function CourseEnrollButton({ item }: { item: CheckoutItem }) {
    const [open, setOpen] = useState(false)
    const price = `${(item.priceCents / 100).toFixed(0)}`
    const label =
        item.itemType === "event"
            ? item.priceCents === 0 ? "Register free" : `Register · ${price}`
            : item.itemType === "product"
                ? item.priceCents === 0 ? "Get free" : `Buy · ${price}`
                : item.itemType === "community"
                    ? item.priceCents === 0 ? "Join free" : `Join · ${price}`
                    : item.priceCents === 0 ? "Enroll free" : `Enroll · ${price}`
    return (
        <>
            <Button className="h-12 w-full rounded-full bg-brand text-brand-foreground" onClick={() => setOpen(true)}>
                {label}
            </Button>
            {open && <CheckoutSheet item={item} onClose={() => setOpen(false)} />}
        </>
    )
}
