import { z } from "zod"

export const PROFILE_IMPORT_POLICY = Object.freeze({
    version: "profile-import-v1",
    credits: 10,
    maxLinks: 5,
    maxDiscoveredLinks: 5,
    maxTextCharacters: 100_000,
    maxSourceBytes: 48_000,
    maxRequestBytes: 64_000,
    maxOutputTokens: 7_000,
    maxResponseBytes: 100_000,
    pageBytes: 512_000,
    pageTimeoutMs: 8_000,
    providerTimeoutMs: 90_000,
    draftLifetimeMs: 7 * 24 * 60 * 60 * 1000,
})

const text = (max: number) => z.string().trim().max(max).refine(value => !value.includes("\u0000"), "Text cannot contain NUL characters")
const required = (max: number) => text(max).refine(value => value.length > 0, "Required")
export const sourceRefsSchema = z.array(required(80)).max(10)
export const profileImportSourceSchema = z.object({
    id: required(80),
    label: required(200),
    url: text(2048).nullable(),
    status: z.enum(["read", "blocked", "failed", "candidate"]),
    discoveredFrom: text(2048).nullable(),
    warning: text(500).nullable(),
}).strict()
const evidence = { sourceIds: sourceRefsSchema, basis: z.enum(["sourced", "suggested"]) }
export const frameworkDraftSchema = z.object({
    title: required(160),
    description: required(1200),
    sourceIds: sourceRefsSchema,
    questions: z.array(z.object({
        id: required(40),
        label: required(300),
        guidance: text(500),
    }).strict()).min(2).max(12),
}).strict()
export const profileBlueprintSchema = z.object({
    version: z.literal(1),
    profile: z.object({
        displayName: required(120),
        headline: required(200),
        bio: required(8000),
        welcome: required(500),
        sourceIds: sourceRefsSchema.min(1),
    }).strict(),
    needId: z.enum(["sell", "dine", "time", "teach", "ca", "hire", "show", "leads", "page", "field", "salon", "eventStudio", "estate", "recruit", "jewelryRetail", "goldWholesale", "distribute", "pharmacy", "autoParts"]),
    addons: z.array(z.enum(["leads", "shop", "menu", "digital", "services", "calendar", "courses", "events", "portfolio"])).max(9),
    socials: z.array(z.object({ label: required(80), url: required(2048), sourceIds: sourceRefsSchema.min(1) }).strict()).max(12),
    experiences: z.array(z.object({ company: required(160), role: required(160), startDate: text(40), endDate: text(40).nullable(), description: required(2000), sourceIds: sourceRefsSchema.min(1) }).strict()).max(15),
    projects: z.array(z.object({ title: required(160), description: required(2000), client: text(160).nullable(), year: text(40).nullable(), sourceIds: sourceRefsSchema.min(1) }).strict()).max(10),
    services: z.array(z.object({ title: required(160), description: required(2000), durationMinutes: z.number().int().min(10).max(480), price: z.number().min(0).max(1_000_000).nullable(), currency: z.enum(["INR", "USD", "EUR", "GBP"]), ...evidence }).strict()).max(8),
    products: z.array(z.object({ title: required(160), description: required(2000), price: z.number().min(0).max(1_000_000).nullable(), currency: z.enum(["INR", "USD", "EUR", "GBP"]), ...evidence }).strict()).max(8),
    knowledge: z.array(z.object({ title: required(160), body: required(6000), visibility: z.enum(["PUBLIC", "CLIENT", "PRIVATE"]), ...evidence }).strict()).max(12),
    introductions: z.array(z.object({ intent: required(60), text: required(700), sourceIds: sourceRefsSchema }).strict()).max(5),
    frameworks: z.array(frameworkDraftSchema).max(3),
    missingInformation: z.array(required(300)).max(20),
}).strict()

export type ProfileBlueprint = z.infer<typeof profileBlueprintSchema>
export type ProfileImportSource = z.infer<typeof profileImportSourceSchema>
export type FrameworkDraft = z.infer<typeof frameworkDraftSchema>
export type ProfileImportContext = { profileId: string } | { billingAccountId?: string }
export type ProfileImportInput = {
    requestId: string
    links: string[]
    text: string
    discover: boolean
}
export type ProfileImportPreview = {
    id: string
    status: "READY" | "APPLIED"
    draft: ProfileBlueprint
    sources: ProfileImportSource[]
    warnings: string[]
    appliedProfileId: string | null
    slug: string | null
}
