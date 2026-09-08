import { PolicyPage } from "@/components/marketing/policy-page"
import { policyDocuments } from "@/lib/marketing-policies"
import { marketingMetadata } from "@/lib/marketing-seo"

const document = policyDocuments.cookiePolicy

export const metadata = marketingMetadata({
    title: document.title,
    description: document.description,
    path: "/cookie-policy",
    index: false,
})

export default function CookiePolicyPage() {
    return <PolicyPage document={document} />
}
