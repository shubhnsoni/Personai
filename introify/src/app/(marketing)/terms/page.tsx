import { PolicyPage } from "@/components/marketing/policy-page"
import { policyDocuments } from "@/lib/marketing-policies"
import { marketingMetadata } from "@/lib/marketing-seo"

const document = policyDocuments.terms

export const metadata = marketingMetadata({
    title: document.title,
    description: document.description,
    path: "/terms",
    index: false,
})

export default function TermsPage() {
    return <PolicyPage document={document} />
}
