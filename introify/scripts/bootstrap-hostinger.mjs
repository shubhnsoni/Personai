import { resolve, dirname } from "node:path"
import { pathToFileURL, fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { PrismaClient } from "@prisma/client"

// A create-only counterpart to prisma/seed.ts. The legacy seed intentionally
// refreshes demo content; deployments must preserve every existing record.
const DEMO_CLERK_ID = "mock-clerk-id-new"
const DEMO_EMAIL = "demo@introify.com"

const PRESETS = [
    {
        id: "introify-preset-aqua-v1", aliases: ["GlowOrb", "Aqua"], name: "Aqua",
        description: "Navy-to-cyan glass orb. Slow drift.",
        config: { variant: "aqua", colors: ["#00D7FF", "#07104D"], speed: 1, intensity: 1 },
    },
    {
        id: "introify-preset-forest-v1", aliases: ["LiquidSphere", "Forest"], name: "Forest",
        description: "Deep green core that breathes.",
        config: { variant: "forest", colors: ["#34D399", "#052E1A"], speed: 0.9, intensity: 1 },
    },
    {
        id: "introify-preset-ember-v1", aliases: ["SoftPulse", "Ember"], name: "Ember",
        description: "Warm fireglass with a flicker.",
        config: { variant: "ember", colors: ["#FFB020", "#3A0A08"], speed: 1.15, intensity: 1.1 },
    },
    {
        id: "introify-preset-violet-v1", aliases: ["Violet"], name: "Violet",
        description: "Aurora sweep through amethyst.",
        config: { variant: "violet", colors: ["#C084FC", "#1E0B3A"], speed: 1, intensity: 1 },
    },
    {
        id: "introify-preset-sunrise-v1", aliases: ["Sunrise"], name: "Sunrise",
        description: "Rose and coral, a warm pulse.",
        config: { variant: "sunrise", colors: ["#FB7185", "#431407"], speed: 1.05, intensity: 1 },
    },
    {
        id: "introify-preset-ice-v1", aliases: ["Ice"], name: "Ice",
        description: "Pale crystal with a bright shimmer.",
        config: { variant: "ice", colors: ["#E0F2FE", "#0C1929"], speed: 0.85, intensity: 1.05 },
    },
    {
        id: "introify-preset-bit-v1", aliases: ["8-Bit Slime", "Bit Slime", "8-Bit"], name: "8-Bit",
        description: "Two rectangle eyes. No orb.",
        config: { look: "pixel", skin: "bit", variant: "forest", colors: ["#34D399", "#052E1A"], speed: 0.95, intensity: 1 },
    },
    {
        id: "introify-preset-crt-v1", aliases: ["CRT", "Phosphor"], name: "CRT",
        description: "Scanline phosphor eyes.",
        config: { look: "pixel", skin: "crt", variant: "aqua", colors: ["#00D7FF", "#07104D"], speed: 1, intensity: 1.1 },
    },
    {
        id: "introify-preset-spark-v1", aliases: ["Spark", "Pixel Spark"], name: "Spark",
        description: "Twin pixel stars.",
        config: { look: "pixel", skin: "spark", variant: "ember", colors: ["#FFB020", "#3A0A08"], speed: 1.05, intensity: 1.1 },
    },
    {
        id: "introify-preset-blob-v1", aliases: ["Blob", "Bloub"], name: "Blob",
        description: "Morphing blob with 8 shapes and 16 faces.",
        config: { look: "bloub", shape: "cercle", expression: "surpris", color: "blanc", variant: "aqua", colors: ["#f7f7f8", "#d8d8dc"], speed: 1, intensity: 1 },
    },
]

function demoContent() {
    return {
        slug: "demo",
        displayName: "Riley Vale",
        headline: "Independent consultant · official Introify demo",
        bio: "I help operators turn their expertise into a page that chats, books, and sells. This is a live Introify profile — the same surface you get at introify.com/you.",
        roleTemplate: "CONSULTANT",
        primaryGoal: "BOOK_CALL",
        isPublic: true,
        workExperiences: { create: [
            {
                company: "Introify", role: "Founding creator partner", startDate: "2025",
                description: "The official live demo. Shows what a working AI clone looks like for an independent consultant.",
            },
        ] },
        projects: { create: [
            {
                title: "Operator OS", client: "Northline Studio", year: "2025",
                description: "Positioning and offer stack for a B2B consultancy moving off custom proposals.",
            },
        ] },
        serviceOfferings: { create: [
            { name: "Strategy session", description: "One-on-one working session to tighten your offer and next 90 days.", priceCents: 20000, durationMinutes: 60, isActive: true },
            { name: "Offer review", description: "Fast feedback on your current page, pricing, and call-to-action.", priceCents: 9000, durationMinutes: 30, isActive: true },
        ] },
        digitalProducts: { create: [
            { title: "Offer stack workbook", description: "A practical PDF to name your offer, price it, and write the page.", type: "PDF", priceCents: 2900, isActive: true },
            { title: "Discovery call script", description: "A short script your AI (or you) can use to qualify inbound leads.", type: "PDF", priceCents: 1900, isActive: true },
        ] },
    }
}

/** @param {import("@prisma/client").PrismaClient} prisma */
export async function bootstrapDatabase(prisma) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await prisma.$transaction(async (tx) => {
                // Names are not unique in the preset table. Serialize bootstrap
                // runs before reading; ReadCommitted sees the preceding run's commit.
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(1937036402, 1)`
                const presets = await tx.welcomeAnimationPreset.findMany()
                let presetsCreated = 0
                for (const preset of PRESETS) {
                    if (presets.some((row) => row.id === preset.id || preset.aliases.includes(row.name))) continue
                    const created = await tx.welcomeAnimationPreset.create({ data: {
                        id: preset.id,
                        name: preset.name,
                        description: preset.description,
                        config: JSON.stringify(preset.config),
                        isDefault: preset.name === "Blob" && !presets.some((row) => row.isDefault),
                    } })
                    presets.push(created)
                    presetsCreated++
                }

                const existingDemo = await tx.profile.findUnique({ where: { slug: "demo" }, select: { id: true } })
                if (existingDemo) return { presetsCreated, demo: "existing" }
                const existingWorkspace = await tx.workspace.findUnique({ where: { slug: "demo" }, select: { id: true } })
                if (existingWorkspace) return { presetsCreated, demo: "skipped-workspace-conflict" }

                const byClerkId = await tx.user.findUnique({ where: { clerkId: DEMO_CLERK_ID } })
                const byEmail = await tx.user.findUnique({ where: { email: DEMO_EMAIL } })
                if ((byClerkId && byClerkId.email !== DEMO_EMAIL) || (byEmail && byEmail.clerkId !== DEMO_CLERK_ID)) {
                    return { presetsCreated, demo: "skipped-identity-conflict" }
                }
                const demoUser = byClerkId || await tx.user.create({ data: {
                    clerkId: DEMO_CLERK_ID, email: DEMO_EMAIL, name: "Riley Vale",
                } })
                const animation = presets.find((row) => row.isDefault)
                    || presets.find((row) => ["Blob", "Bloub"].includes(row.name))
                    || presets[0]
                await tx.profile.create({ data: {
                    ...demoContent(), userId: demoUser.id, animationStyleId: animation?.id,
                } })
                return { presetsCreated, demo: "created" }
            }, { isolationLevel: "ReadCommitted", maxWait: 15_000, timeout: 60_000 })
        } catch (error) {
            // A concurrent non-bootstrap writer can claim a unique identity.
            // Restart the rolled-back transaction and recheck, never overwrite.
            if (attempt < 2 && ["P2002", "P2034"].includes(error?.code)) continue
            throw error
        }
    }
    throw new Error("Database bootstrap retry limit reached")
}

function seedDemoShops() {
    if (process.env.INTROIFY_SEED_DEMOS === "false" || process.env.INTROIFY_SEED_DEMOS === "0") {
        console.log("Demo shop seed skipped.")
        return
    }
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
    const result = spawnSync(process.execPath, ["--import", "tsx", "src/lib/demo-shops/cli.ts"], {
        cwd: root,
        env: process.env,
        stdio: "inherit",
        windowsHide: true,
        timeout: 210_000,
        killSignal: "SIGKILL",
    })
    if (result.error) {
        console.error("Demo shop seed did not finish:", result.error.message)
        return
    }
    if (result.status !== 0) {
        console.error(`Demo shop seed exited ${result.status ?? "unknown"}; continuing Hostinger build.`)
    }
}

async function main() {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for database bootstrap")
    const prisma = new PrismaClient()
    try {
        const result = await bootstrapDatabase(prisma)
        console.log(`Database bootstrap: ${result.presetsCreated} presets created; demo ${result.demo}.`)
        seedDemoShops()
    } finally {
        await prisma.$disconnect()
    }
}

// Importing this module for tests never opens a database connection.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main().catch((error) => {
        console.error("Database bootstrap failed.", error?.code || "Check the database configuration and deployed migrations.")
        process.exitCode = 1
    })
}
