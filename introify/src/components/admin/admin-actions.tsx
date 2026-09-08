"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import {
    publishShop,
    setShopAiOverride,
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
                <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => suspendShop(profileId))}>
                    Suspend
                </Button>
            )}
            {isPublic ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => unpublishShop(profileId))}>
                    Unpublish
                </Button>
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
                <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => setUserRole(userId, "CREATOR"))}>
                    Demote
                </Button>
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
                <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => suspendUser(userId))}>
                    Suspend shops
                </Button>
            )}
        </div>
    )
}
