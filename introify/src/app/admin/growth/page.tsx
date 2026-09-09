import { AdminPageHead, AdminPanel } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"

export default function AdminGrowthPage() {
    return (
        <div className="space-y-5">
            <AdminPageHead
                title="Growth"
                hint="Platform coupons and owner-brings-owner codes are not built yet. Shop offers stay in Studio."
            />
            <AdminPanel>
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    This route is unshipped from the nav until invite codes exist. Do not count shop catalog objects here.
                </p>
            </AdminPanel>
        </div>
    )
}
