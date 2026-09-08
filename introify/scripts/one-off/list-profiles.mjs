import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const profiles = await p.profile.findMany({
    where: { userId: "cmsvh9izg0000bwji3oipg9im", slug: { startsWith: "try-" } },
    orderBy: { slug: "asc" },
    select: {
        slug: true,
        displayName: true,
        headline: true,
        imageUrl: true,
        roleTemplate: true,
        _count: {
            select: {
                digitalProducts: true,
                courses: true,
                events: true,
                leadMagnets: true,
                projects: true,
                workExperiences: true,
                serviceOfferings: true,
            },
        },
    },
})
console.log(JSON.stringify(profiles, null, 2))
await p.$disconnect()
