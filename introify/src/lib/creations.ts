import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/slugs"

export const CREATION_VISIBILITY = ["PRIVATE", "UNLISTED", "SHOWCASE"] as const
export type CreationVisibility = (typeof CREATION_VISIBILITY)[number]

export function isCreationVisibility(value: string): value is CreationVisibility {
    return (CREATION_VISIBILITY as readonly string[]).includes(value)
}

export async function uniqueCreationSlug(profileId: string, name: string) {
    const base = slugify(name) || "ai"
    let slug = base.slice(0, 40)
    let n = 2
    while (await prisma.creation.findUnique({ where: { profileId_slug: { profileId, slug } } })) {
        slug = `${base.slice(0, 36)}-${n}`
        n += 1
    }
    return slug
}

export function instructionsFromAnswers(answers: {
    name: string
    goodAt: string
    process: string
    input: string
    output: string
    examples?: string
}) {
    return [
        `You are ${answers.name}, a named AI creation on Introify.`,
        `You are good at: ${answers.goodAt}`,
        `How the creator works: ${answers.process}`,
        `Someone will give you: ${answers.input}`,
        `You should produce: ${answers.output}`,
        answers.examples ? `Examples and references:\n${answers.examples}` : "",
        "Stay inside Read and Create. Do not take financial, destructive, or external actions. If you are unsure, say so and ask a precise question.",
    ].filter(Boolean).join("\n\n")
}

export async function listCreations(profileId: string) {
    return prisma.creation.findMany({
        where: { profileId },
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { runs: true, knowledge: true } } },
    })
}

export async function listShowcaseCreations(profileId: string) {
    return prisma.creation.findMany({
        where: { profileId, visibility: "SHOWCASE" },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, slug: true, purpose: true, description: true, allowVisitorChat: true },
    })
}

export async function getOwnedCreation(profileId: string, id: string) {
    return prisma.creation.findFirst({
        where: { id, profileId },
        include: {
            knowledge: { orderBy: { createdAt: "desc" } },
            jobs: { orderBy: { createdAt: "desc" } },
            _count: { select: { runs: true } },
        },
    })
}

export async function createCreation(profileId: string, input: {
    name: string
    purpose?: string
    description?: string
    instructions?: string
    visibility?: CreationVisibility
}) {
    const name = input.name.trim().slice(0, 80)
    if (name.length < 2) throw new Error("Give this AI a name.")
    const slug = await uniqueCreationSlug(profileId, name)
    return prisma.creation.create({
        data: {
            profileId,
            name,
            slug,
            purpose: input.purpose?.trim().slice(0, 280) || null,
            description: input.description?.trim().slice(0, 2000) || null,
            instructions: input.instructions?.trim() || null,
            visibility: input.visibility && isCreationVisibility(input.visibility) ? input.visibility : "PRIVATE",
        },
    })
}

export async function updateCreation(profileId: string, id: string, input: {
    name?: string
    purpose?: string
    description?: string
    instructions?: string
    visibility?: string
    allowVisitorChat?: boolean
    avatar?: string | null
}) {
    const existing = await prisma.creation.findFirst({ where: { id, profileId } })
    if (!existing) return null
    const data: Record<string, unknown> = {}
    if (typeof input.name === "string") data.name = input.name.trim().slice(0, 80)
    if (typeof input.purpose === "string") data.purpose = input.purpose.trim().slice(0, 280)
    if (typeof input.description === "string") data.description = input.description.trim().slice(0, 2000)
    if (typeof input.instructions === "string") data.instructions = input.instructions.trim()
    if (typeof input.allowVisitorChat === "boolean") data.allowVisitorChat = input.allowVisitorChat
    if (input.avatar !== undefined) data.avatar = input.avatar
    if (typeof input.visibility === "string") {
        if (input.visibility === "FOR_HIRE" || !isCreationVisibility(input.visibility)) {
            throw new Error("For Hire is not available in this phase.")
        }
        data.visibility = input.visibility
        if (input.visibility !== "SHOWCASE") data.allowVisitorChat = false
    }
    return prisma.creation.update({ where: { id }, data })
}

export async function addCreationKnowledge(profileId: string, id: string, title: string, rawText: string) {
    const existing = await prisma.creation.findFirst({ where: { id, profileId }, select: { id: true } })
    if (!existing) return null
    const text = rawText.trim()
    if (text.length < 8) throw new Error("Add a short note, example, or correction.")
    return prisma.creationKnowledge.create({
        data: { creationId: id, title: title.trim().slice(0, 120) || "Note", rawText: text.slice(0, 20_000) },
    })
}
