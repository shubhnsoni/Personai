import { PolicyPage } from "./policy-page"
import type { PolicyDocument } from "@/lib/marketing-policies"
import { getRequestLocale } from "@/lib/ui-locale-request"

export async function LocalizedPolicyPage({ document }: { document: PolicyDocument }) {
    return <PolicyPage document={document} locale={await getRequestLocale()} />
}
