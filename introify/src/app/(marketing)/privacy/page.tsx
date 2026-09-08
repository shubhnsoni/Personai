import { PolicyPage } from "@/components/marketing/policy-page"
import { policyDocuments } from "@/lib/marketing-policies"
import { marketingMetadata } from "@/lib/marketing-seo"

const document = policyDocuments.privacy

export const metadata = marketingMetadata({
    title: document.title,
    description: document.description,
    path: "/privacy",
    index: false,
})

export default function PrivacyPage() {
    return <PolicyPage document={document} />
}
