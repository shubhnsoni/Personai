import { LocalizedPolicyPage } from "@/components/marketing/localized-policy"
import { policyDocuments } from "@/lib/marketing-policies"
import { marketingMetadata } from "@/lib/marketing-seo"

const document = policyDocuments.refundPolicy

export const metadata = marketingMetadata({
    title: document.title,
    description: document.description,
    path: "/refund-policy",
    index: false,
})

export default function RefundPolicyPage() {
    return <LocalizedPolicyPage document={document} />
}
