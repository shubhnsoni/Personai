import { LocalizedPolicyPage } from "@/components/marketing/localized-policy"
import { policyDocuments } from "@/lib/marketing-policies"
import { marketingMetadata } from "@/lib/marketing-seo"

const document = policyDocuments.terms

export const metadata = marketingMetadata({
    title: document.title,
    description: document.description,
    path: "/terms",
})

export default function TermsPage() {
    return <LocalizedPolicyPage document={document} />
}
