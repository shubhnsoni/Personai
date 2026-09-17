import { PrismaClient } from "@prisma/client"
import { ensureTryHotelDemo } from "../src/lib/hotels/try-hotel-seed.ts"

const prisma = new PrismaClient()
try {
    const result = await ensureTryHotelDemo(prisma)
    const rooms = result.rooms.length ? result.rooms.join(",") : "(none)"
    const qrs = result.qrs?.length ? result.qrs.map((row) => `${row.kind}:${row.code}`).join(",") : "(none)"
    console.log(`Try-hotel ensure: created=${result.created}; skipped=${result.skipped.join(",") || "(none)"}; rooms=${rooms}; restaurant=${result.restaurant || "(none)"}; qrs=${qrs}`)
} catch (error) {
    console.error("Try-hotel ensure failed:", error?.code || error?.message || error)
    process.exitCode = 1
} finally {
    await prisma.$disconnect()
}
