import { randomUUID } from "node:crypto"
import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { ensureDefaultBillingAccount, withAccountLimit } from "@/lib/billing/service"
import { allocateBusinessSlug } from "@/lib/business-slug"
import { needById, type NeedId } from "@/lib/onboarding-needs"
import { applyOwnedProfileImport, runProfileImportGeneration } from "@/lib/profile-import-run"
import { PROFILE_IMPORT_POLICY, type ProfileBlueprint } from "@/lib/profile-import-contract"

export type AdminCreateAccountInput = {
    email: string
    name?: string
    displayName?: string
    slug?: string
    phone?: string
    bio?: string
    needId?: string
    importLinks?: string[]
    importText?: string
    runImport?: boolean
}

export type AdminCreateAccountResult = {
    userId: string
    profileId: string
    slug: string
    email: string
    clerkUserId: string
    createdUser: boolean
    createdProfile: boolean
    invited: boolean
    import?: { status: "APPLIED" | "READY" | "SKIPPED" | "FAILED"; error?: string; previewId?: string }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(raw: string) {
    return raw.trim().toLowerCase()
}

function splitName(name: string | undefined) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean)
    return { firstName: parts[0] || undefined, lastName: parts.slice(1).join(" ") || undefined }
}

function clerkErrorCode(error: unknown): string {
    if (!error || typeof error !== "object") return ""
    const bag = error as { errors?: Array<{ code?: string }>; status?: number }
    return bag.errors?.[0]?.code || ""
}

async function findClerkUsersByEmail(email: string) {
    const client = await clerkClient()
    const list = await client.users.getUserList({ emailAddress: [email], limit: 5 })
    return list.data || []
}

async function ensureClerkUser(email: string, name?: string): Promise<{ id: string; created: boolean }> {
    const existing = await findClerkUsersByEmail(email)
    if (existing.length > 1) {
        throw new Error("That email is attached to more than one Clerk user. Merge those accounts before creating this shop.")
    }
    if (existing[0]) return { id: existing[0].id, created: false }
    const client = await clerkClient()
    const names = splitName(name)
    try {
        const created = await client.users.createUser({
            emailAddress: [email],
            firstName: names.firstName,
            lastName: names.lastName,
            skipPasswordChecks: true,
            skipPasswordRequirement: true,
        })
        return { id: created.id, created: true }
    } catch (error) {
        if (clerkErrorCode(error) === "form_identifier_exists" || /already exists|identifier/i.test(error instanceof Error ? error.message : "")) {
            const raced = await findClerkUsersByEmail(email)
            if (raced.length === 1) return { id: raced[0].id, created: false }
            if (raced.length > 1) throw new Error("That email is attached to more than one Clerk user. Merge those accounts before creating this shop.")
        }
        throw error
    }
}

async function maybeInvite(email: string, createdClerkUser: boolean) {
    if (!createdClerkUser) return false
    try {
        const client = await clerkClient()
        await client.invitations.createInvitation({ emailAddress: email, ignoreExisting: true, notify: true })
        return true
    } catch {
        return false
    }
}

export async function provisionAdminAccount(input: AdminCreateAccountInput): Promise<AdminCreateAccountResult> {
    const email = normalizeEmail(input.email || "")
    if (!EMAIL.test(email) || email.length > 191) throw new Error("Enter a valid email address.")
    const name = (input.name || "").trim() || email.split("@")[0]
    const displayName = (input.displayName || name).trim()
    if (!displayName) throw new Error("Enter a display name.")
    const need = needById(input.needId as NeedId | undefined)
    const phone = (input.phone || "").trim() || null
    const bio = (input.bio || "").trim() || null
    const links = (input.importLinks || []).map(link => link.trim()).filter(Boolean).slice(0, PROFILE_IMPORT_POLICY.maxLinks)
    const importText = input.importText || ""
    if (importText.length > PROFILE_IMPORT_POLICY.maxTextCharacters) throw new Error(`Paste at most ${PROFILE_IMPORT_POLICY.maxTextCharacters.toLocaleString()} characters.`)

    const clerk = await ensureClerkUser(email, name)
    const localByEmail = await prisma.user.findUnique({ where: { email }, include: { profiles: { orderBy: { updatedAt: "desc" } } } })
    const localByClerk = await prisma.user.findUnique({ where: { clerkId: clerk.id }, include: { profiles: { orderBy: { updatedAt: "desc" } } } })
    if (localByEmail && localByClerk && localByEmail.id !== localByClerk.id) {
        throw new Error("That email and Clerk user point at different local accounts. Merge those rows before continuing.")
    }

    let createdUser = false
    let user = localByEmail || localByClerk
    if (user) {
        await prisma.user.update({
            where: { id: user.id },
            data: {
                clerkId: clerk.id,
                email,
                name,
                emailVerifiedAt: user.emailVerifiedAt || new Date(),
            },
        })
    } else {
        user = await prisma.user.create({
            data: {
                clerkId: clerk.id,
                email,
                name,
                emailVerifiedAt: new Date(),
                role: "CREATOR",
            },
            include: { profiles: { orderBy: { updatedAt: "desc" } } },
        })
        createdUser = true
    }

    const account = await ensureDefaultBillingAccount(user.id)
    const existingProfile = (user.profiles || [])[0] || null
    const slug = existingProfile
        ? (input.slug?.trim() ? await allocateBusinessSlug(displayName, input.slug, existingProfile.id) : existingProfile.slug)
        : await allocateBusinessSlug(displayName, input.slug)

    const profile = existingProfile
        ? await withAccountLimit(account.id, "businesses", 0, async tx => {
            return tx.profile.update({
                where: { id: existingProfile.id },
                data: {
                    displayName,
                    bio: bio ?? undefined,
                    whatsapp: phone ?? undefined,
                    headline: existingProfile.headline || need.headline,
                    roleTemplate: input.needId ? need.role : undefined,
                    primaryGoal: input.needId ? need.goal : undefined,
                    slug,
                    billingAccountId: existingProfile.billingAccountId || account.id,
                },
            })
        })
        : await withAccountLimit(account.id, "businesses", 1, async tx => {
            const created = await tx.profile.create({
                data: {
                    userId: user.id,
                    billingAccountId: account.id,
                    slug,
                    displayName,
                    headline: need.headline,
                    bio,
                    roleTemplate: need.role,
                    primaryGoal: need.goal,
                    language: "en",
                    timezone: "UTC",
                    isPublic: true,
                    whatsapp: phone,
                },
            })
            const workspace = await tx.workspace.create({
                data: {
                    profileId: created.id,
                    billingAccountId: account.id,
                    name: created.displayName,
                    slug: created.slug,
                },
            })
            await tx.membership.create({
                data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
            })
            return created
        })

    const invited = await maybeInvite(email, clerk.created)
    const result: AdminCreateAccountResult = {
        userId: user.id,
        profileId: profile.id,
        slug: profile.slug,
        email,
        clerkUserId: clerk.id,
        createdUser,
        createdProfile: !existingProfile,
        invited,
    }

    if (input.runImport && (links.length || importText.trim())) {
        try {
            const preview = await runProfileImportGeneration(
                { userId: user.id, accountId: account.id, targetProfileId: profile.id },
                { requestId: randomUUID(), links, text: importText, discover: true },
            )
            const applied = await applyOwnedProfileImport(
                { userId: user.id, accountId: account.id, profileId: profile.id },
                preview.id,
                preview.draft as ProfileBlueprint,
                { overwriteProfile: false, applyFeatures: true },
            )
            result.import = { status: "APPLIED", previewId: preview.id }
            result.slug = applied.slug
            result.profileId = applied.profileId
        } catch (error) {
            result.import = {
                status: "FAILED",
                error: error instanceof Error ? error.message.slice(0, 500) : "Import did not complete.",
            }
        }
    }

    return result
}
