import { LocalizedPolicyPage } from "@/components/marketing/localized-policy"
import { policyDocuments } from "@/lib/marketing-policies"
import { marketingMetadata } from "@/lib/marketing-seo"

const document = policyDocuments.about

export const metadata = marketingMetadata({
    title: document.title,
    description: document.description,
    path: "/about",
    index: false,
})

export default function AboutPage() {
    return <LocalizedPolicyPage document={document} />
}
