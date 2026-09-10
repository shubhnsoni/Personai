import { LocalizedPolicyPage } from "@/components/marketing/localized-policy"
import { policyDocuments } from "@/lib/marketing-policies"
import { marketingMetadata } from "@/lib/marketing-seo"

const document = policyDocuments.acceptableUse

export const metadata = marketingMetadata({
    title: document.title,
    description: document.description,
    path: "/acceptable-use",
    index: false,
})

export default function AcceptableUsePage() {
    return <LocalizedPolicyPage document={document} />
}
