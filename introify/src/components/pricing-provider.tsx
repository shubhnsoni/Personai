"use client"

import { createContext, useCallback, useContext } from "react"
import { formatStoredPrice, type DisplayCurrency } from "@/lib/pricing"

const PricingContext = createContext<{ currency: DisplayCurrency }>({ currency: "USD" })

export function PricingProvider({
    currency,
    children,
}: {
    currency: DisplayCurrency
    children: React.ReactNode
}) {
    return <PricingContext.Provider value={{ currency }}>{children}</PricingContext.Provider>
}

export function usePricing() {
    return useContext(PricingContext)
}

export function useMoney() {
    const { currency } = usePricing()
    return useCallback(
        (amountCents: number, stored?: string | null) => formatStoredPrice(amountCents, stored, currency),
        [currency],
    )
}
