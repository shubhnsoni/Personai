import type { Prisma } from "@prisma/client"
import { assertAccountLimit } from "@/lib/billing/service"
import { extrasFromAddons, type AddonId } from "@/lib/onboarding-needs"
import { extrasOf, writeExtras } from "@/lib/surfaces"
import { writeSocials, socialsFromConfig, type SocialLinks } from "@/lib/socials"
import type { ProfileBlueprint } from "@/lib/profile-import-contract"

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ")

const SOCIAL_HOSTS: Record<keyof SocialLinks, string[]> = {
    instagram: ["instagram.com"],
    facebook: ["facebook.com", "fb.com"],
    youtube: ["youtube.com", "youtu.be"],
    maps: ["maps.google.com", "maps.app.goo.gl"],
    zomato: ["zomato.com"],
    linkedin: ["linkedin.com"],
}

function hostMatches(hostname: string, host: string) {
    return hostname === host || hostname.endsWith(`.${host}`)
}

function safeSocialUrl(raw: string): URL | null {
    try {
        const url = new URL(raw.trim())
        if (url.protocol !== "https:" && url.protocol !== "http:") return null
        if (url.username || url.password || url.port) return null
        return url
    } catch {
        return null
    }
}

function isMapsUrl(url: URL): boolean {
    const hostname = url.hostname.toLowerCase()
    if (SOCIAL_HOSTS.maps.some(host => hostMatches(hostname, host))) return true
    return hostMatches(hostname, "google.com") && url.pathname.startsWith("/maps")
}

export function partitionSocials(draft: ProfileBlueprint): { supported: SocialLinks; unsupported: string[] } {
    const supported: SocialLinks = {}
    const unsupported: string[] = []
    for (const social of draft.socials) {
        const url = safeSocialUrl(social.url)
        if (!url) { unsupported.push(social.url); continue }
        const hostname = url.hostname.toLowerCase()
        const key = isMapsUrl(url)
            ? "maps" as const
            : (Object.keys(SOCIAL_HOSTS) as (keyof SocialLinks)[]).find(k => k !== "maps" && SOCIAL_HOSTS[k].some(host => hostMatches(hostname, host)))
        if (key && !supported[key]) supported[key] = url.toString()
        else unsupported.push(social.url)
    }
    return { supported, unsupported }
}

export function unsupportedSocialWarnings(draft: ProfileBlueprint): string[] {
    return partitionSocials(draft).unsupported.map(url => `Kept for review but not shown: ${url}`)
}

export async function applyProfileBlueprintTx(
    tx: Prisma.TransactionClient,
    profile: { id: string; billingAccountId: string; displayName: string; headline: string | null; bio: string | null; personalityConfig: string | null; roleTemplate: string; welcomeMessageOverride?: string | null },
    draft: ProfileBlueprint,
    options: { overwriteProfile: boolean; applyFeatures: boolean },
): Promise<void> {
    const profileId = profile.id

    const [experiences, projects, services, products, documents, frameworks, introductions] = await Promise.all([
        tx.workExperience.findMany({ where: { profileId }, select: { company: true, role: true, startDate: true, endDate: true } }),
        tx.project.findMany({ where: { profileId }, select: { title: true } }),
        tx.serviceOffering.findMany({ where: { profileId }, select: { name: true } }),
        tx.digitalProduct.findMany({ where: { profileId }, select: { title: true } }),
        tx.profileDocument.findMany({ where: { profileId }, select: { title: true } }),
        tx.profileFramework.findMany({ where: { profileId }, select: { title: true } }),
        tx.profileIntroduction.findMany({ where: { profileId }, select: { intent: true } }),
    ])
    const have = {
        experience: new Set(experiences.map(e => norm(`${e.company}|${e.role}|${e.startDate}|${e.endDate || ""}`))),
        project: new Set(projects.map(p => norm(p.title))),
        service: new Set(services.map(s => norm(s.name))),
        product: new Set(products.map(p => norm(p.title))),
        document: new Set(documents.map(d => norm(d.title))),
        framework: new Set(frameworks.map(f => norm(f.title))),
        introduction: new Set(introductions.map(i => norm(i.intent))),
    }

    const pendingDocs: typeof draft.knowledge = []
    const seenTitles = new Set(have.document)
    for (const item of draft.knowledge) {
        const key = norm(item.title)
        if (!item.body.trim() || seenTitles.has(key)) continue
        seenTitles.add(key)
        pendingDocs.push(item)
    }
    if (pendingDocs.length) {
        await assertAccountLimit(tx, profile.billingAccountId, "knowledgeSources", pendingDocs.length)
        await assertAccountLimit(tx, profile.billingAccountId, "knowledgeCharacters", pendingDocs.reduce((n, k) => n + k.body.length, 0))
    }

    const data: Record<string, unknown> = {}
    const fill = (field: "displayName" | "headline" | "bio" | "welcomeMessageOverride", existing: string | null, incoming: string) => {
        if (options.overwriteProfile || !existing?.trim()) data[field] = incoming
    }
    fill("displayName", profile.displayName, draft.profile.displayName)
    fill("headline", profile.headline, draft.profile.headline)
    fill("bio", profile.bio, draft.profile.bio)
    fill("welcomeMessageOverride", profile.welcomeMessageOverride ?? null, draft.profile.welcome)

    const { supported } = partitionSocials(draft)
    const mergedSocials = { ...supported, ...socialsFromConfig(profile.personalityConfig) }

    let personality = profile.personalityConfig
    personality = writeSocials(personality, mergedSocials)
    if (options.applyFeatures && draft.addons.length) {
        const existing = extrasOf(personality)
        const added = extrasFromAddons(profile.roleTemplate, draft.addons as AddonId[])
        personality = writeExtras(personality, {
            surfaces: [...new Set([...(existing.surfaces || []), ...(added.surfaces || [])])],
            packs: [...new Set([...(existing.packs || []), ...(added.packs || [])])],
            addons: [...new Set([...(existing.addons || []), ...(added.addons || [])])],
        })
    }
    data.personalityConfig = personality

    if (Object.keys(data).length) await tx.profile.update({ where: { id: profileId }, data })

    const seenExperiences = new Set(have.experience)
    for (const item of draft.experiences) {
        const key = norm(`${item.company}|${item.role}|${item.startDate}|${item.endDate || ""}`)
        if (seenExperiences.has(key)) continue
        seenExperiences.add(key)
        await tx.workExperience.create({
            data: { profileId, company: item.company, role: item.role, startDate: item.startDate, endDate: item.endDate || null, description: item.description },
        })
    }

    const seenProjects = new Set(have.project)
    for (const item of draft.projects) {
        const key = norm(item.title)
        if (seenProjects.has(key)) continue
        seenProjects.add(key)
        await tx.project.create({
            data: { profileId, title: item.title, description: item.description, client: item.client || null, year: item.year || null },
        })
    }

    const seenServices = new Set(have.service)
    for (const item of draft.services) {
        const key = norm(item.title)
        if (seenServices.has(key)) continue
        seenServices.add(key)
        await tx.serviceOffering.create({
            data: {
                profileId, name: item.title, description: item.description,
                durationMinutes: item.durationMinutes,
                priceCents: item.price === null ? 0 : Math.round(item.price * 100),
                currency: item.currency, isActive: false, isFree: false, kind: "SESSION",
            },
        })
    }

    const seenProducts = new Set(have.product)
    for (const item of draft.products) {
        const key = norm(item.title)
        if (seenProducts.has(key)) continue
        seenProducts.add(key)
        await tx.digitalProduct.create({
            data: {
                profileId, title: item.title, description: item.description,
                type: "OTHER", fulfillment: "DIGITAL", fileUrl: null,
                priceCents: item.price === null ? 0 : Math.round(item.price * 100),
                currency: item.currency, isActive: false,
            },
        })
    }

    for (const item of pendingDocs) {
        const sourced = item.basis === "sourced"
        await tx.profileDocument.create({
            data: {
                profileId, type: "TEXT", title: item.title, sourceType: "PROFILE_IMPORT",
                rawText: item.body, embedding: [],
                visibility: sourced ? item.visibility : "PRIVATE",
                publicationState: sourced ? "PUBLISHED" : "DRAFT",
            },
        })
    }

    const seenFrameworks = new Set(have.framework)
    for (const framework of draft.frameworks) {
        const key = norm(framework.title)
        if (seenFrameworks.has(key)) continue
        seenFrameworks.add(key)
        await tx.profileFramework.create({
            data: {
                profileId, title: framework.title, description: framework.description,
                definition: framework as unknown as Prisma.InputJsonValue,
                status: "DRAFT", scoringApproved: false,
            },
        })
    }

    const seenIntents = new Set(have.introduction)
    for (const intro of draft.introductions) {
        const key = norm(intro.intent)
        if (seenIntents.has(key)) continue
        seenIntents.add(key)
        await tx.profileIntroduction.create({
            data: { profileId, intent: intro.intent, text: intro.text, status: "DRAFT" },
        })
    }
}
