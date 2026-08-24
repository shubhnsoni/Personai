import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const profile = await prisma.profile.findUnique({
        where: { slug: "sylvie" },
        include: {
            user: true,
            animationStyle: true,
            workExperiences: true,
            projects: true,
            serviceOfferings: true,
            documents: true,
            digitalProducts: { include: { purchases: true } },
            courses: { include: { modules: { include: { lessons: true } } } },
            events: true,
            communities: true,
            leadMagnets: true,
            shortLinks: true,
            leads: true,
            bookings: true,
            payments: true,
            availability: true,
            conversations: { include: { messages: true } },
        },
    })
    if (!profile) {
        console.log("NO PROFILE")
        return
    }
    const summary = {
        id: profile.id,
        slug: profile.slug,
        displayName: profile.displayName,
        headline: profile.headline,
        bio: profile.bio,
        roleTemplate: profile.roleTemplate,
        primaryGoal: profile.primaryGoal,
        language: profile.language,
        timezone: profile.timezone,
        isPublic: profile.isPublic,
        welcome: profile.welcomeMessageOverride,
        personality: profile.personalityConfig,
        aiModel: profile.aiModel,
        theme: profile.animationStyle?.name,
        themeColor: profile.themeColor,
        contentDisplayMode: profile.contentDisplayMode,
        user: { email: profile.user.email, name: profile.user.name, clerkId: profile.user.clerkId, image: profile.user.image },
        counts: {
            work: profile.workExperiences.length,
            projects: profile.projects.length,
            services: profile.serviceOfferings.length,
            docs: profile.documents.length,
            products: profile.digitalProducts.length,
            courses: profile.courses.length,
            events: profile.events.length,
            communities: profile.communities.length,
            magnets: profile.leadMagnets.length,
            links: profile.shortLinks.length,
            leads: profile.leads.length,
            bookings: profile.bookings.length,
            payments: profile.payments.length,
            avail: profile.availability.length,
            convos: profile.conversations.length,
        },
        work: profile.workExperiences,
        projects: profile.projects,
        services: profile.serviceOfferings,
        products: profile.digitalProducts,
        courses: profile.courses,
        events: profile.events,
        communities: profile.communities,
        magnets: profile.leadMagnets,
        links: profile.shortLinks,
        docs: profile.documents.map((d) => ({ type: d.type, title: d.title, hasText: !!d.rawText })),
        leads: profile.leads,
        bookings: profile.bookings,
        payments: profile.payments,
        avail: profile.availability,
        convos: profile.conversations.map((c) => ({ id: c.id, visitor: c.visitorName, msgs: c.messages.length })),
    }
    console.log(JSON.stringify(summary, null, 2))
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
