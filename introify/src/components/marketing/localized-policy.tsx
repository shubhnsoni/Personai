import { PolicyPage } from "./policy-page"
import { ContactForm } from "./contact-form"
import type { PolicyDocument } from "@/lib/marketing-policies"
import { marketingBusiness } from "@/lib/marketing-business"
import { getRequestLocale } from "@/lib/ui-locale-request"

export async function LocalizedPolicyPage({ document }: { document: PolicyDocument }) {
    const locale = await getRequestLocale()
    return (
        <PolicyPage document={document} locale={locale}>
            {document.slug === "contact" ? <ContactForm supportEmail={marketingBusiness.supportEmail} locale={locale} /> : null}
        </PolicyPage>
    )
}
