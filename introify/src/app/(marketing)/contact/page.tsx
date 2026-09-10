import { LocalizedPolicyPage } from "@/components/marketing/localized-policy"
import { policyDocuments } from "@/lib/marketing-policies"
import { marketingMetadata } from "@/lib/marketing-seo"

const document = policyDocuments.contact

export const metadata = marketingMetadata({
    title: document.title,
    description: document.description,
    path: "/contact",
    index: false,
})

export default function ContactPage() {
    return <LocalizedPolicyPage document={document} />
}
