"use client"

import { useState } from "react"
import { CheckoutSheet, type CheckoutItem } from "@/components/checkout/checkout-sheet"

export type PdpBuyAction = {
    label: string
    item?: CheckoutItem
    href?: string
    external?: boolean
}

function Cta({
    action,
    onOpen,
}: {
    action: PdpBuyAction
    onOpen: () => void
}) {
    if (action.href) {
        return (
            <a
                className="cta"
                href={action.href}
                target={action.external ? "_blank" : undefined}
                rel={action.external ? "noreferrer" : undefined}
            >
                {action.label}
            </a>
        )
    }
    const sold = action.item?.soldOut
    return (
        <button type="button" className="cta" disabled={sold} onClick={onOpen}>
            {sold ? "Sold out" : action.label}
        </button>
    )
}

export function PdpBuy({
    action,
    sticky,
}: {
    action: PdpBuyAction
    sticky?: boolean
}) {
    const [open, setOpen] = useState(false)
    const cta = <Cta action={action} onOpen={() => setOpen(true)} />
    return (
        <>
            {sticky ? <div className="sticky-bar">{cta}</div> : cta}
            {open && action.item ? <CheckoutSheet item={action.item} onClose={() => setOpen(false)} /> : null}
        </>
    )
}
