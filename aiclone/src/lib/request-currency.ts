import { headers } from "next/headers"
import { countryFromHeaders, currencyForCountry, type DisplayCurrency } from "@/lib/pricing"

export async function getRequestCurrency(): Promise<DisplayCurrency> {
    const h = await headers()
    return currencyForCountry(countryFromHeaders(h))
}
