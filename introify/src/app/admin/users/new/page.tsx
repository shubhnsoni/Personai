import Link from "@/components/navigation/transition-link"
import { AdminPageHead, AdminPanel } from "@/components/admin/admin-ui"
import { AdminCreateAccountForm } from "@/components/admin/admin-create-account-form"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export default function AdminCreateAccountPage() {
    return (
        <div className="space-y-5">
            <AdminPageHead
                title="Create account"
                hint="New or existing email. Fills the shop profile and can run import."
                action={<Link href="/admin/users" className="text-xs text-muted-foreground hover:underline">Back to people</Link>}
            />
            <AdminPanel>
                <div className="p-4">
                    <AdminCreateAccountForm />
                </div>
            </AdminPanel>
        </div>
    )
}
