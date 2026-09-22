import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = join(process.cwd())

describe("P0 SkyDine place-order dueAt schema", () => {
    it("ships a migration that adds Order.dueAt and staffNote", () => {
        const sqlPath = join(root, "prisma/migrations/20260923010000_order_due_at_staff_note/migration.sql")
        expect(existsSync(sqlPath)).toBe(true)
        const sql = readFileSync(sqlPath, "utf8")
        expect(sql).toMatch(/ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "dueAt"/)
        expect(sql).toMatch(/ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "staffNote"/)
    })

    it("sets dueAt on order.create and does not raw-update dueAt", () => {
        const src = readFileSync(join(root, "src/lib/restaurant-order-service.ts"), "utf8")
        expect(src).toMatch(/dueAt,/)
        expect(src).not.toMatch(/UPDATE "Order" SET "dueAt"/)
        expect(src).toMatch(/Number\(allocated\[0\]\?\.value\)/)
    })
})
