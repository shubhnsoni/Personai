const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
    const profile = await prisma.profile.findFirst({
        where: { slug: "sylvie" },
        select: { id: true, displayName: true },
    })
    if (!profile) {
        console.log("no sylvie")
        return
    }
    const convos = await prisma.conversation.findMany({
        where: { profileId: profile.id },
        orderBy: { lastMessageAt: "desc" },
        take: 8,
        include: {
            messages: {
                orderBy: { createdAt: "desc" },
                take: 8,
            },
        },
    })
    for (const c of convos) {
        console.log("\n==== CONV", c.id, c.visitorName || c.visitorEmail || c.visitorId, c.lastMessageAt)
        for (const m of c.messages.reverse()) {
            console.log("---", m.senderType, m.role, m.createdAt.toISOString())
            console.log(m.text)
        }
    }
}

main().finally(() => prisma.$disconnect())
