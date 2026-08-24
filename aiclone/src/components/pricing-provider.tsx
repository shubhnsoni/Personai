"use client"

import { createContext, useCallback, useContext } from "react"
import { formatMoney, type DisplayCurrency } from "@/lib/pricing"

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
    return useCallback((usdCents: number) => formatMoney(usdCents, currency), [currency])
}
