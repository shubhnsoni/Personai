import { PolicyPage } from "@/components/marketing/policy-page"
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
    return <PolicyPage document={document} />
}
