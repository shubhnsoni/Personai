import { PolicyPage } from "@/components/marketing/policy-page"
import { policyDocuments } from "@/lib/marketing-policies"
import { marketingMetadata } from "@/lib/marketing-seo"

const document = policyDocuments.smsPolicy

export const metadata = marketingMetadata({
    title: document.title,
    description: document.description,
    path: "/sms-policy",
    index: false,
})

export default function SmsPolicyPage() {
    return <PolicyPage document={document} />
}
