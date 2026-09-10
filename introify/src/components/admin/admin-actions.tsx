"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import {
    publishShop,
    setShopAiOverride,
    setUserPlan,
    setUserRole,
    startImpersonate,
    stopImpersonate,
    suspendShop,
    suspendUser,
    unpublishShop,
    unsuspendShop,
    unsuspendUser,
} from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { AdminConfirm } from "@/components/admin/admin-confirm"
import { PLANS, type PlanId } from "@/lib/billing/catalog"

export function ImpersonateButton({
    profileId,
    href = "/dashboard",
    label = "Open as support",
}: {
    profileId: string
    href?: string
    label?: string
}) {
    const router = useRouter()
    const [pending, start] = useTransition()
    return (
        <Button
            size="sm"
            disabled={pending}
            onClick={() => start(async () => {
                await startImpersonate(profileId)
                router.push(href)
            })}
        >
            {label}
        </Button>
    )
}

export function ShopAdminButtons({
    profileId,
    isPublic,
    suspended,
}: {
    profileId: string
    isPublic: boolean
    suspended: boolean
}) {
    const [pending, start] = useTransition()
    return (
        <div className="flex flex-wrap gap-2">
            <ImpersonateButton profileId={profileId} />
            {suspended ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => unsuspendShop(profileId))}>
                    Unsuspend
                </Button>
            ) : (
                <AdminConfirm
                    title="Suspend this shop?"
                    description="The public page goes down until you unsuspend it."
                    confirmLabel="Suspend"
                    onConfirm={() => suspendShop(profileId)}
                >
                    <Button size="sm" variant="outline" disabled={pending}>Suspend</Button>
                </AdminConfirm>
            )}
            {isPublic ? (
                <AdminConfirm
                    title="Unpublish this shop?"
                    description="Visitors will see Profile Not Found until you publish again."
                    confirmLabel="Unpublish"
                    onConfirm={() => unpublishShop(profileId)}
                >
                    <Button size="sm" variant="outline" disabled={pending}>Unpublish</Button>
                </AdminConfirm>
            ) : (
                <Button size="sm" variant="outline" disabled={pending || suspended} onClick={() => start(() => publishShop(profileId))}>
                    Publish
                </Button>
            )}
        </div>
    )
}

export function ExitImpersonateButton() {
    const router = useRouter()
    const [pending, start] = useTransition()
    return (
        <button
            type="button"
            disabled={pending}
            className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-medium"
            onClick={() => start(async () => {
                await stopImpersonate()
                router.push("/admin/shops")
            })}
        >
            Exit
        </button>
    )
}

export function ShopAiOverrideSelect({
    profileId,
    value,
}: {
    profileId: string
    value: string | null
}) {
    const [pending, start] = useTransition()
    return (
        <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            disabled={pending}
            defaultValue={value || ""}
            onChange={(e) => start(() => setShopAiOverride(profileId, e.target.value as "" | "codex" | "xai" | "openai"))}
        >
            <option value="">Platform default</option>
            <option value="codex">Codex</option>
            <option value="xai">SpaceXAI</option>
            <option value="openai">OpenAI</option>
        </select>
    )
}

export function UserPlanSelect({
    userId,
    planId,
}: {
    userId: string
    planId: PlanId
}) {
    const [pending, start] = useTransition()
    return (
        <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            disabled={pending}
            defaultValue={planId}
            aria-label="Assign plan"
            onChange={(event) => start(() => setUserPlan(userId, event.target.value))}
        >
            {PLANS.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
        </select>
    )
}

export function UserAdminButtons({
    userId,
    role,
    suspended,
}: {
    userId: string
    role: string
    suspended: boolean
}) {
    const [pending, start] = useTransition()
    return (
        <div className="flex flex-wrap gap-2">
            {role === "ADMIN" ? (
                <AdminConfirm
                    title="Demote this admin?"
                    description="They will lose /admin. Allowlisted emails cannot be demoted."
                    confirmLabel="Demote"
                    onConfirm={() => setUserRole(userId, "CREATOR")}
                >
                    <Button size="sm" variant="outline" disabled={pending}>Demote</Button>
                </AdminConfirm>
            ) : (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => setUserRole(userId, "ADMIN"))}>
                    Make admin
                </Button>
            )}
            {suspended ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => unsuspendUser(userId))}>
                    Unsuspend shops
                </Button>
            ) : (
                <AdminConfirm
                    title="Suspend all shops for this user?"
                    description="Every public page they own will go down."
                    confirmLabel="Suspend shops"
                    onConfirm={() => suspendUser(userId)}
                >
                    <Button size="sm" variant="outline" disabled={pending}>Suspend shops</Button>
                </AdminConfirm>
            )}
        </div>
    )
}
