import type { PrismaClient } from "@prisma/client"

type Showcase = {
    slug: string
    clerkId: string
    email: string
    displayName: string
    headline: string
    bio: string
    roleTemplate: string
    primaryGoal: string
    imageUrl: string
    welcome: string
    tone: string
    customInstructions: string
    experiences: { company: string; role: string; startDate: string; endDate: string | null; description: string }[]
    projects: { title: string; description: string; client: string; year: string }[]
    services: { name: string; description: string; priceCents: number; durationMinutes: number }[]
    documents: { title: string; rawText: string }[]
}

const SHOWCASES: Showcase[] = [
    {
        slug: "maya",
        clerkId: "mock-clerk-id-maya",
        email: "maya@introify.com",
        displayName: "Maya Lane",
        headline: "Brand designer for thoughtful businesses",
        bio: "I help independent businesses look and feel like themselves — identity, websites, and the words that introduce the work.",
        roleTemplate: "DESIGNER",
        primaryGoal: "BOOK_CALL",
        imageUrl: "/marketing/design-consultant.png",
        welcome: "I’m Maya. Tell me what you’re making and I’ll point you to the right piece of work.",
        tone: "warm",
        customInstructions: "You are Maya Lane, a brand designer. Answer as Maya. Ground replies in the selected work, services, and process notes. Offer a conversation, not a hard sell. If you don’t know a price beyond the listed services, say so.",
        experiences: [
            { company: "Maya Lane Studio", role: "Principal designer", startDate: "2019", endDate: null, description: "Identity, websites, and art direction for independent brands." },
            { company: "Northline", role: "Brand designer", startDate: "2015", endDate: "2019", description: "Campaign systems and packaging for small consumer brands." },
        ],
        projects: [
            { title: "make something matter.", description: "Identity and site for a studio that wanted quieter work and clearer next steps.", client: "Independent", year: "2025" },
            { title: "Sunday Coffee", description: "A neighbourhood café mark, menus, and a page that answers dietary questions.", client: "Sunday Coffee", year: "2024" },
        ],
        services: [
            { name: "Brand design & websites", description: "A working identity and a site that introduces the work.", priceCents: 480000, durationMinutes: 60 },
            { name: "Let’s talk", description: "A 30-minute conversation about fit, timeline, and what to bring.", priceCents: 0, durationMinutes: 30 },
        ],
        documents: [
            { title: "How Maya works", rawText: "Maya Lane is a brand designer. Selected work lives on this page. Brand design and websites is the main offering. Let’s talk is the first conversation. She helps thoughtful businesses look and feel like themselves. No photoreal 3D packs, no SMS, no voice calls." },
            { title: "Typical questions", rawText: "What do you design? Identity, websites, and the words around them. How do we start? Book Let’s talk. Do you work remotely? Yes, with clients who already know what they make." },
        ],
    },
    {
        slug: "littlehours",
        clerkId: "mock-clerk-id-littlehours",
        email: "littlehours@introify.com",
        displayName: "Little Hours Café",
        headline: "Good coffee. A warmer welcome.",
        bio: "A neighbourhood café. Oat-milk drinks, dairy-free options, and a menu you can read before you order.",
        roleTemplate: "RESTAURANT",
        primaryGoal: "WHATSAPP",
        imageUrl: "/marketing/cafe-owner.png",
        welcome: "Welcome to Little Hours. Ask about the menu, dairy-free drinks, or when we’re open.",
        tone: "warm",
        customInstructions: "You are the guide for Little Hours Café. Answer menu, allergen, and hours questions from the notes. Be brief and kind. If something isn’t listed, say you’ll check with the counter.",
        experiences: [],
        projects: [],
        services: [
            { name: "Table for two", description: "A quiet table. Ask about dairy-free drinks when you sit down.", priceCents: 0, durationMinutes: 60 },
        ],
        documents: [
            { title: "Menu notes", rawText: "Little Hours Café serves coffee, tea, and a small food menu. Dairy-free: oat-milk drinks, dairy-free cakes on Fridays. House oat latte, filter coffee, chai. Food: toast, seasonal salad, a cookie. We do not do full table service after 3pm — counter order." },
            { title: "Hours and welcome", rawText: "Open 8am–4pm most days. Closed Tuesdays. A guest can read the menu on this page before they order. Dairy-free options are marked. Good coffee. A warmer welcome." },
        ],
    },
    {
        slug: "formandfield",
        clerkId: "mock-clerk-id-formandfield",
        email: "formandfield@introify.com",
        displayName: "Form & Field",
        headline: "Ceramics and everyday objects from independent makers",
        bio: "A small shop for handmade pieces with a little more story — cups, vases, and objects you can live with.",
        roleTemplate: "SHOP",
        primaryGoal: "WHATSAPP",
        imageUrl: "/marketing/ceramic-artist.png",
        welcome: "This is Form & Field. Ask about a piece, the makers, or how to visit the shop.",
        tone: "calm",
        customInstructions: "You are the guide for Form & Field, a makers shop. Talk about ceramics and everyday objects. Point people to the collection and visiting the shop. Do not invent stock counts.",
        experiences: [],
        projects: [
            { title: "Maker table", description: "A rotating shelf of cups and small vases from nearby studios.", client: "Shop floor", year: "2025" },
        ],
        services: [
            { name: "Visit the shop", description: "See the current collection in person. Thursday–Sunday.", priceCents: 0, durationMinutes: 30 },
        ],
        documents: [
            { title: "The collection", rawText: "Form & Field brings together ceramics and everyday objects from independent makers. Cups, vases, small boards. Each piece has a maker note. Explore the collection on this page, then visit or message the shop." },
            { title: "Visiting", rawText: "Open Thursday–Sunday, 11am–6pm. Pieces are one-offs; if something sold, we’ll say so. No photoreal 3D try-on. Handmade, not mass retail." },
        ],
    },
    {
        slug: "slowdays",
        clerkId: "mock-clerk-id-slowdays",
        email: "slowdays@introify.com",
        displayName: "Slow Days Studio",
        headline: "A little space for yourself",
        bio: "Beginner-friendly classes, a gentle first visit, and a schedule you can read before you show up.",
        roleTemplate: "SALON_SPA",
        primaryGoal: "BOOK_CALL",
        imageUrl: "/marketing/everyday/studio.webp",
        welcome: "Welcome to Slow Days. New to yoga? Start with the beginner class.",
        tone: "calm",
        customInstructions: "You are the guide for Slow Days Studio. Help newcomers understand beginner class, what to bring, and how to get in touch. Do not diagnose or promise medical outcomes.",
        experiences: [],
        projects: [],
        services: [
            { name: "Beginner class", description: "A gentle place to begin. Mats provided. Come a few minutes early.", priceCents: 1500, durationMinutes: 60 },
        ],
        documents: [
            { title: "First visit", rawText: "Slow Days Studio is for people who want a little space. Beginner class is the right start. Wear comfortable clothes. Mats are provided. See the schedule on this page and contact the studio with questions. No voice calls through Introify — use the page." },
        ],
    },
]

export const SHOWCASE_SLUGS = SHOWCASES.map((item) => item.slug)

export async function seedShowcaseProfiles(prisma: PrismaClient) {
    const defaultPreset = await prisma.welcomeAnimationPreset.findFirst({ where: { isDefault: true } })
    for (const item of SHOWCASES) {
        const user = await prisma.user.upsert({
            where: { clerkId: item.clerkId },
            update: { name: item.displayName, email: item.email },
            create: { clerkId: item.clerkId, email: item.email, name: item.displayName },
        })
        const profile = await prisma.profile.upsert({
            where: { slug: item.slug },
            update: {
                displayName: item.displayName,
                headline: item.headline,
                bio: item.bio,
                roleTemplate: item.roleTemplate,
                primaryGoal: item.primaryGoal,
                imageUrl: item.imageUrl,
                isPublic: true,
                liveChatEnabled: true,
                welcomeMessageOverride: item.welcome,
                personalityConfig: JSON.stringify({
                    tone: item.tone,
                    language: "en",
                    responseLength: "medium",
                    customInstructions: item.customInstructions,
                }),
                animationStyleId: defaultPreset?.id,
            },
            create: {
                userId: user.id,
                slug: item.slug,
                displayName: item.displayName,
                headline: item.headline,
                bio: item.bio,
                roleTemplate: item.roleTemplate,
                primaryGoal: item.primaryGoal,
                imageUrl: item.imageUrl,
                isPublic: true,
                liveChatEnabled: true,
                welcomeMessageOverride: item.welcome,
                personalityConfig: JSON.stringify({
                    tone: item.tone,
                    language: "en",
                    responseLength: "medium",
                    customInstructions: item.customInstructions,
                }),
                animationStyleId: defaultPreset?.id,
            },
        })

        await prisma.workExperience.deleteMany({ where: { profileId: profile.id } })
        if (item.experiences.length) {
            await prisma.workExperience.createMany({
                data: item.experiences.map((row) => ({ profileId: profile.id, ...row })),
            })
        }
        await prisma.project.deleteMany({ where: { profileId: profile.id } })
        if (item.projects.length) {
            await prisma.project.createMany({
                data: item.projects.map((row) => ({ profileId: profile.id, ...row })),
            })
        }
        await prisma.serviceOffering.deleteMany({ where: { profileId: profile.id, kind: "SESSION" } })
        if (item.services.length) {
            await prisma.serviceOffering.createMany({
                data: item.services.map((row) => ({
                    profileId: profile.id,
                    name: row.name,
                    description: row.description,
                    priceCents: row.priceCents,
                    durationMinutes: row.durationMinutes,
                    isActive: true,
                })),
            })
        }
        await prisma.profileDocument.deleteMany({ where: { profileId: profile.id, sourceType: "TEXT" } })
        await prisma.profileDocument.createMany({
            data: item.documents.map((doc) => ({
                profileId: profile.id,
                type: "TEXT",
                sourceType: "TEXT",
                title: doc.title,
                rawText: doc.rawText,
                visibility: "PUBLIC",
                publicationState: "PUBLISHED",
            })),
        })
        console.log(`Showcase profile ready: /${item.slug}`)
    }
}
