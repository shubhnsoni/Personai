import { HomeLanding } from "@/components/landing/home-landing"
import {
    BRAND_DESCRIPTION,
    marketingMetadata,
    marketingStructuredData,
} from "@/lib/marketing-seo"

export const metadata = marketingMetadata({
    title: "Introify — Your page. With a voice. | AI business pages",
    description: BRAND_DESCRIPTION,
    path: "/",
    languages: true,
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
            <HomeLanding locale="en" />
        </>
    )
}
