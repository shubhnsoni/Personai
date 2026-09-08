import { HomeLanding } from "@/components/landing/home-landing"
import {
    BRAND_DESCRIPTION,
    marketingMetadata,
    marketingStructuredData,
} from "@/lib/marketing-seo"

export const metadata = marketingMetadata({
    title: "Introify — Your personal page, work & bookings in one link",
    description: BRAND_DESCRIPTION,
    path: "/",
})

export default function Home() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(marketingStructuredData()).replace(
                        /</g,
                        "\\u003c",
                    ),
                }}
            />
            <HomeLanding />
        </>
    )
}
