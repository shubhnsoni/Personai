import { LocalizedPolicyPage } from "@/components/marketing/localized-policy"
import { policyDocuments } from "@/lib/marketing-policies"
import { marketingMetadata } from "@/lib/marketing-seo"

const document = policyDocuments.deliveryPolicy

export const metadata = marketingMetadata({
    title: document.title,
    description: document.description,
    path: "/delivery-policy",
    index: false,
})

export default function DeliveryPolicyPage() {
    return <LocalizedPolicyPage document={document} />
}
