"use server"

import { createHash, randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"
import { getAccountBilling, getProfileBilling, withAccountLimit } from "@/lib/billing/service"
import { ACTIVE_PROFILE_COOKIE } from "@/lib/try-kits"
import { canAccessProfile } from "@/lib/workspace-access"

const WORKSPACE_ROLES = ["ADMIN", "MANAGER", "STAFF", "VIEWER"] as const
type InviteRole = typeof WORKSPACE_ROLES[number]
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")
const idsOf = (value: unknown): string[] => Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []

async function authenticated() {
    const user = await syncUser()
    if (!user) throw new Error("Sign in with a verified email address.")
    return user
}

async function requireAccountOwner(accountId: string) {
    const user = await authenticated()
    const account = await prisma.billingAccount.findUnique({ where: { id: accountId } })
    const membership = await prisma.billingAccountMember.findUnique({ where: { accountId_userId: { accountId, userId: user.id } } })
    if (!account || account.ownerUserId !== user.id || membership?.status !== "ACTIVE" || membership.role !== "OWNER") {
        throw new Error("Only the account owner can manage business access.")
    }
    return { user, account }
}

export async function switchBusiness(profileId: string) {
    const user = await authenticated()
    if (!user.accessibleProfiles.some((profile) => profile.id === profileId) || !canAccessProfile(user.profileAccess[profileId], "read")) throw new Error("Business access is unavailable.")
    const jar = await cookies()
    jar.set(ACTIVE_PROFILE_COOKIE, profileId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" })
    revalidatePath("/dashboard", "layout")
}

export async function getTeamManagement() {
    const user = await authenticated()
    const context = user.activeProfile ? await getProfileBilling(user.activeProfile.id) : null
    const ownMembership = context
        ? await prisma.billingAccountMember.findUnique({ where: { accountId_userId: { accountId: context.accountId, userId: user.id } } })
        : await prisma.billingAccountMember.findFirst({ where: { userId: user.id, status: "ACTIVE" }, orderBy: { createdAt: "asc" } })
    if (!ownMembership || ownMembership.status !== "ACTIVE") throw new Error("No billing account is available.")
    const accountId = ownMembership.accountId
    const account = await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } })
    const canManage = account.ownerUserId === user.id && ownMembership.role === "OWNER"
    if (canManage) await withAccountLimit(accountId, "businesses", 0, async (tx) => {
        const profiles = await tx.profile.findMany({ where: { billingAccountId: accountId }, select: { id: true, userId: true, slug: true, displayName: true } })
        for (const profile of profiles) {
            let workspace = await tx.workspace.findUnique({ where: { profileId: profile.id } })
            if (!workspace) {
                const clash = await tx.workspace.findUnique({ where: { slug: profile.slug }, select: { id: true } })
                workspace = await tx.workspace.create({ data: { profileId: profile.id, billingAccountId: accountId, name: profile.displayName, slug: clash ? `${profile.slug}-${profile.id}` : profile.slug } })
            }
            if (workspace.billingAccountId && workspace.billingAccountId !== accountId) throw new Error("Business billing assignment needs review.")
            if (!workspace.billingAccountId) await tx.workspace.update({ where: { id: workspace.id }, data: { billingAccountId: accountId } })
            await tx.membership.upsert({ where: { workspaceId_userId: { workspaceId: workspace.id, userId: profile.userId } }, create: { workspaceId: workspace.id, userId: profile.userId, role: "OWNER" }, update: {} })
        }
    })
    const [billing, workspaces, members, invitations] = await Promise.all([
        getAccountBilling(accountId),
        prisma.workspace.findMany({ where: { billingAccountId: accountId }, select: { id: true, name: true, profileId: true } }),
        canManage ? prisma.billingAccountMember.findMany({ where: { accountId, status: "ACTIVE" }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
        canManage ? prisma.billingInvitation.findMany({ where: { accountId, status: "PENDING", expiresAt: { gt: new Date() } }, select: { id: true, email: true, workspaceRole: true, accountRole: true, expiresAt: true } }) : Promise.resolve([]),
    ])
    const users = members.length ? await prisma.user.findMany({ where: { id: { in: members.map((member) => member.userId) } }, select: { id: true, name: true, email: true } }) : []
    return {
        accountId, name: account.name, ownerUserId: account.ownerUserId, canManage,
        seats: billing.plan.limits.seats, businessLimit: billing.plan.limits.businesses,
        workspaces: canManage ? workspaces : workspaces.filter((workspace) => workspace.profileId && user.accessibleProfiles.some((profile) => profile.id === workspace.profileId)),
        members: members.map((member) => ({ id: member.id, userId: member.userId, role: member.role, name: users.find((user) => user.id === member.userId)?.name || "Member", email: users.find((user) => user.id === member.userId)?.email || "" })),
        invitations: invitations.map((invitation) => ({ ...invitation, expiresAt: invitation.expiresAt.toISOString() })),
    }
}

/** Produces a private invitation link. Email delivery is deliberately a separate user action. */
export async function createTeamInvitation(input: { accountId: string; email: string; workspaceIds: string[]; workspaceRole: InviteRole; accountRole?: "MEMBER" | "BILLING_ADMIN" }) {
    const { user } = await requireAccountOwner(input.accountId)
    const email = input.email.trim().toLowerCase()
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.")
    if (!WORKSPACE_ROLES.includes(input.workspaceRole)) throw new Error("Choose a valid business role.")
    const workspaceIds = [...new Set(input.workspaceIds)].slice(0, 100)
    const accountRole = input.accountRole === "BILLING_ADMIN" ? "BILLING_ADMIN" : "MEMBER"
    if (!workspaceIds.length && accountRole !== "BILLING_ADMIN") throw new Error("Choose at least one business.")
    const token = randomBytes(32).toString("base64url")
    await withAccountLimit(input.accountId, "seats", async (tx) => {
        const existingUser = await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })
        const active = existingUser ? await tx.billingAccountMember.findUnique({ where: { accountId_userId: { accountId: input.accountId, userId: existingUser.id } } }) : null
        const pending = await tx.billingInvitation.findFirst({ where: { accountId: input.accountId, emailKey: email, status: "PENDING", expiresAt: { gt: new Date() } } })
        return active?.status === "ACTIVE" || pending ? 0 : 1
    }, async (tx) => {
        const valid = await tx.workspace.count({ where: { id: { in: workspaceIds }, billingAccountId: input.accountId } })
        if (valid !== workspaceIds.length) throw new Error("A selected business does not belong to this account.")
        const pending = await tx.billingInvitation.findFirst({ where: { accountId: input.accountId, emailKey: email, status: "PENDING", expiresAt: { gt: new Date() } } })
        const data = { email, emailKey: email, tokenHash: hashToken(token), workspaceIds: [...new Set([...idsOf(pending?.workspaceIds), ...workspaceIds])], workspaceRole: input.workspaceRole, accountRole, expiresAt: new Date(Date.now() + 7 * 86400000), invitedBy: user.id }
        if (pending) await tx.billingInvitation.update({ where: { id: pending.id }, data })
        else await tx.billingInvitation.create({ data: { ...data, accountId: input.accountId, status: "PENDING" } })
        await tx.billingAuditEvent.create({ data: { accountId: input.accountId, actorId: user.id, kind: "TEAM_INVITATION_CREATED", metadata: { email, workspaceIds, workspaceRole: input.workspaceRole, accountRole } } })
    })
    revalidatePath("/dashboard/team")
    return { path: `/invitations/${token}` }
}

export async function acceptTeamInvitation(token: string) {
    const user = await authenticated()
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("This invitation is invalid.")
    const invitation = await prisma.billingInvitation.findUnique({ where: { tokenHash: hashToken(token) } })
    if (!invitation) throw new Error("This invitation is invalid.")
    let profileId: string | null = null
    await withAccountLimit(invitation.accountId, "seats", 0, async (tx) => {
        const current = await tx.billingInvitation.findUnique({ where: { id: invitation.id } })
        if (!current || current.emailKey !== user.email.trim().toLowerCase()) throw new Error("Sign in with the email address this invitation was sent to.")
        if (current.status === "ACCEPTED" && current.acceptedBy === user.id) return
        if (current.status !== "PENDING" || current.expiresAt <= new Date()) throw new Error("This invitation has expired or been revoked.")
        const workspaces = await tx.workspace.findMany({ where: { id: { in: idsOf(current.workspaceIds) }, billingAccountId: current.accountId } })
        if (workspaces.length !== idsOf(current.workspaceIds).length) throw new Error("The invitation’s businesses have changed. Ask the owner for a new invitation.")
        const oldMember = await tx.billingAccountMember.findUnique({ where: { accountId_userId: { accountId: current.accountId, userId: user.id } } })
        await tx.billingAccountMember.upsert({
            where: { accountId_userId: { accountId: current.accountId, userId: user.id } },
            create: { accountId: current.accountId, userId: user.id, role: current.accountRole, status: "ACTIVE" },
            update: { role: oldMember?.role === "OWNER" ? "OWNER" : current.accountRole, status: "ACTIVE" },
        })
        for (const workspace of workspaces) {
            const existing = await tx.membership.findUnique({ where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } } })
            if (existing?.role !== "OWNER") await tx.membership.upsert({ where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } }, create: { workspaceId: workspace.id, userId: user.id, role: current.workspaceRole as InviteRole }, update: { role: current.workspaceRole as InviteRole } })
        }
        await tx.billingInvitation.update({ where: { id: current.id }, data: { status: "ACCEPTED", acceptedBy: user.id } })
        await tx.billingAuditEvent.create({ data: { accountId: current.accountId, actorId: user.id, kind: "TEAM_INVITATION_ACCEPTED", metadata: { invitationId: current.id } } })
        profileId = workspaces.find((workspace) => workspace.profileId)?.profileId || null
    })
    if (profileId) (await cookies()).set(ACTIVE_PROFILE_COOKIE, profileId, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" })
    revalidatePath("/dashboard", "layout")
}

export async function revokeTeamInvitation(accountId: string, invitationId: string) {
    const { user } = await requireAccountOwner(accountId)
    await withAccountLimit(accountId, "seats", 0, async (tx) => {
        const result = await tx.billingInvitation.updateMany({ where: { id: invitationId, accountId, status: "PENDING" }, data: { status: "REVOKED" } })
        if (result.count) await tx.billingAuditEvent.create({ data: { accountId, actorId: user.id, kind: "TEAM_INVITATION_REVOKED", metadata: { invitationId } } })
    })
    revalidatePath("/dashboard/team")
}

export async function removeAccountMember(accountId: string, memberUserId: string) {
    const { account, user } = await requireAccountOwner(accountId)
    if (memberUserId === account.ownerUserId) throw new Error("The account owner cannot be removed.")
    await withAccountLimit(accountId, "seats", 0, async (tx) => {
        await tx.billingAccountMember.updateMany({ where: { accountId, userId: memberUserId, role: { not: "OWNER" } }, data: { status: "REVOKED" } })
        const workspaces = await tx.workspace.findMany({ where: { billingAccountId: accountId }, select: { id: true } })
        await tx.membership.deleteMany({ where: { workspaceId: { in: workspaces.map((workspace) => workspace.id) }, userId: memberUserId, role: { not: "OWNER" } } })
        const member = await tx.user.findUnique({ where: { id: memberUserId }, select: { email: true } })
        if (member) await tx.billingInvitation.updateMany({ where: { accountId, emailKey: member.email.trim().toLowerCase(), status: "PENDING" }, data: { status: "REVOKED" } })
        await tx.billingAuditEvent.create({ data: { accountId, actorId: user.id, kind: "TEAM_MEMBER_REMOVED", metadata: { memberUserId } } })
    })
    revalidatePath("/dashboard", "layout")
}
