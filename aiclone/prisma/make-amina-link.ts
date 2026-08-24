import { PrismaClient } from "@prisma/client"
import { createHash, randomBytes } from "crypto"

const prisma = new PrismaClient()

async function main() {
    const member = await prisma.member.findUnique({ where: { email: "amina@example.com" } })
    if (!member) throw new Error("no member")
    const token = randomBytes(32).toString("hex")
    await prisma.libraryLink.create({
        data: {
            memberId: member.id,
            tokenHash: createHash("sha256").update(token).digest("hex"),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    })
    console.log(`/library/enter?token=${token}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
