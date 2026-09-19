import { env } from "@/lib/env"
import { ensureSeedWhatsappNumber, listWhatsappBusinessNumbers } from "@/lib/whatsapp/numbers"
import { AdminPageHead } from "@/components/admin/admin-ui"
import { WhatsappNumbersAdmin } from "@/components/admin/whatsapp-numbers-admin"

export const dynamic = "force-dynamic"

export default async function AdminWhatsappPage() {
    await ensureSeedWhatsappNumber().catch(() => null)
    const numbers = await listWhatsappBusinessNumbers().catch(() => [])
    const webhookUrl = `${env.appUrl.replace(/\/$/, "")}/api/whatsapp/twilio`
    return (
        <div className="space-y-5">
            <AdminPageHead
                title="WhatsApp"
                hint="Manage Twilio WhatsApp business numbers. Link, rotate, disable, or unlink anytime without redeploying."
            />
            <WhatsappNumbersAdmin numbers={numbers} webhookUrl={webhookUrl} />
        </div>
    )
}
