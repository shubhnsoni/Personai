import { PrismaClient } from "@prisma/client"
import { ensureShowcaseProfiles } from "../src/lib/showcase-profiles.ts"

const prisma = new PrismaClient()
try {
    const result = await ensureShowcaseProfiles(prisma)
    const created = result.created.length ? result.created.join(",") : "(none)"
    const skipped = result.skipped.length ? result.skipped.join(",") : "(none)"
    console.log(`Showcase ensure: created=${created}; skipped=${skipped}`)
} catch (error) {
    console.error("Showcase ensure failed:", error?.code || error?.message || error)
    process.exitCode = 1
} finally {
    await prisma.$disconnect()
}
