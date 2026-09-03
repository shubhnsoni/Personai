import { prisma } from "@/lib/prisma"
import { randomBytes } from "node:crypto"

export function metalId() {
    return "m" + randomBytes(12).toString("hex")
}

export type PartyRow = {
    id: string
    profileId: string
    kind: string
    displayName: string
    phone: string | null
    termsDays: number
    creditLimitPaise: number
}

export type LotRow = {
    id: string
    profileId: string
    productId: string | null
    title: string
    grossMg: number
    remainingGrossMg: number
    remainingQty: number
    purityBps: number
    costTouchBps: number
    sourceBillId: string | null
}

export type BillRow = {
    id: string
    profileId: string
    partyAccountId: string
    kind: string
    k24PaisePer10g: number
    totalPaise: number
    paidPaise: number
    payStatus: string
    dueOn: Date | null
    publicToken: string
    liftedAt: Date | null
    createdAt: Date
}

export type BillLineRow = {
    id: string
    billId: string
    lotId: string | null
    title: string
    grossMg: number
    touchBpsBilled: number
    makingPaise: number
    linePaise: number
}

export async function sqlPartyById(id: string, profileId: string) {
    const rows = await prisma.$queryRaw<PartyRow[]>`
        SELECT id, "profileId", kind, "displayName", phone, "termsDays", "creditLimitPaise"
        FROM "PartyAccount" WHERE id = ${id} AND "profileId" = ${profileId} LIMIT 1`
    return rows[0] ?? null
}

export async function sqlPartyByPhone(profileId: string, kind: string, phone: string) {
    const rows = await prisma.$queryRaw<PartyRow[]>`
        SELECT id, "profileId", kind, "displayName", phone, "termsDays", "creditLimitPaise"
        FROM "PartyAccount" WHERE "profileId" = ${profileId} AND kind = ${kind} AND phone = ${phone} LIMIT 1`
    return rows[0] ?? null
}

export async function sqlInsertParty(row: PartyRow) {
    await prisma.$executeRaw`
        INSERT INTO "PartyAccount" (id, "profileId", kind, "displayName", phone, "termsDays", "creditLimitPaise", "updatedAt")
        VALUES (${row.id}, ${row.profileId}, ${row.kind}, ${row.displayName}, ${row.phone}, ${row.termsDays}, ${row.creditLimitPaise}, NOW())`
    return row
}

export async function sqlUpdateParty(id: string, displayName: string, termsDays: number, creditLimitPaise: number) {
    await prisma.$executeRaw`
        UPDATE "PartyAccount" SET "displayName" = ${displayName}, "termsDays" = ${termsDays}, "creditLimitPaise" = ${creditLimitPaise}, "updatedAt" = NOW()
        WHERE id = ${id}`
}

export async function sqlListParties(profileId: string) {
    return prisma.$queryRaw<PartyRow[]>`
        SELECT id, "profileId", kind, "displayName", phone, "termsDays", "creditLimitPaise"
        FROM "PartyAccount" WHERE "profileId" = ${profileId} ORDER BY "displayName" ASC`
}

export async function sqlListLots(profileId: string) {
    return prisma.$queryRaw<LotRow[]>`
        SELECT id, "profileId", "productId", title, "grossMg", "remainingGrossMg", "remainingQty", "purityBps", "costTouchBps", "sourceBillId"
        FROM "MetalLot" WHERE "profileId" = ${profileId} AND "remainingGrossMg" > 0 ORDER BY "createdAt" DESC`
}

export async function sqlLotById(id: string, profileId: string) {
    const rows = await prisma.$queryRaw<LotRow[]>`
        SELECT id, "profileId", "productId", title, "grossMg", "remainingGrossMg", "remainingQty", "purityBps", "costTouchBps", "sourceBillId"
        FROM "MetalLot" WHERE id = ${id} AND "profileId" = ${profileId} LIMIT 1`
    return rows[0] ?? null
}

export async function sqlInsertLot(row: LotRow) {
    await prisma.$executeRaw`
        INSERT INTO "MetalLot" (id, "profileId", "productId", title, "grossMg", "remainingGrossMg", "remainingQty", "purityBps", "costTouchBps", "sourceBillId", "updatedAt")
        VALUES (${row.id}, ${row.profileId}, ${row.productId}, ${row.title}, ${row.grossMg}, ${row.remainingGrossMg}, ${row.remainingQty}, ${row.purityBps}, ${row.costTouchBps}, ${row.sourceBillId}, NOW())`
    return row
}

export async function sqlConsumeLot(id: string, takeMg: number, takeQty: number) {
    const n = await prisma.$executeRaw`
        UPDATE "MetalLot"
        SET "remainingGrossMg" = "remainingGrossMg" - ${takeMg},
            "remainingQty" = GREATEST(0, "remainingQty" - ${takeQty}),
            "updatedAt" = NOW()
        WHERE id = ${id} AND "remainingGrossMg" >= ${takeMg}`
    if (n === 0) throw new Error("Not enough stock")
}

export async function sqlSetLotProduct(id: string, productId: string) {
    await prisma.$executeRaw`UPDATE "MetalLot" SET "productId" = ${productId}, "updatedAt" = NOW() WHERE id = ${id}`
}

export async function sqlLotBySourceBill(sourceBillId: string) {
    const rows = await prisma.$queryRaw<LotRow[]>`
        SELECT id, "profileId", "productId", title, "grossMg", "remainingGrossMg", "remainingQty", "purityBps", "costTouchBps", "sourceBillId"
        FROM "MetalLot" WHERE "sourceBillId" = ${sourceBillId} LIMIT 1`
    return rows[0] ?? null
}

export async function sqlInsertBill(row: BillRow) {
    await prisma.$executeRaw`
        INSERT INTO "MetalBill" (id, "profileId", "partyAccountId", kind, "k24PaisePer10g", "totalPaise", "paidPaise", "payStatus", "dueOn", "publicToken", "updatedAt")
        VALUES (${row.id}, ${row.profileId}, ${row.partyAccountId}, ${row.kind}, ${row.k24PaisePer10g}, ${row.totalPaise}, ${row.paidPaise}, ${row.payStatus}, ${row.dueOn}, ${row.publicToken}, NOW())`
    return row
}

export async function sqlInsertLine(row: BillLineRow & { qty: number }) {
    await prisma.$executeRaw`
        INSERT INTO "MetalBillLine" (id, "billId", "lotId", title, "grossMg", "touchBpsBilled", "makingPaise", "linePaise", qty)
        VALUES (${row.id}, ${row.billId}, ${row.lotId}, ${row.title}, ${row.grossMg}, ${row.touchBpsBilled}, ${row.makingPaise}, ${row.linePaise}, ${row.qty})`
}

export async function sqlOpenBills(profileId: string, partyId: string, ids?: string[]) {
    if (ids?.length) {
        return prisma.$queryRaw<BillRow[]>`
            SELECT id, "profileId", "partyAccountId", kind, "k24PaisePer10g", "totalPaise", "paidPaise", "payStatus", "dueOn", "publicToken", "liftedAt", "createdAt"
            FROM "MetalBill"
            WHERE "profileId" = ${profileId} AND "partyAccountId" = ${partyId}
              AND "payStatus" IN ('UNPAID','PARTIAL') AND id IN (${ids[0]})
            ORDER BY "createdAt" ASC`
    }
    return prisma.$queryRaw<BillRow[]>`
        SELECT id, "profileId", "partyAccountId", kind, "k24PaisePer10g", "totalPaise", "paidPaise", "payStatus", "dueOn", "publicToken", "liftedAt", "createdAt"
        FROM "MetalBill"
        WHERE "profileId" = ${profileId} AND "partyAccountId" = ${partyId} AND "payStatus" IN ('UNPAID','PARTIAL')
        ORDER BY "createdAt" ASC`
}

export async function sqlMarkBillPaid(id: string, paidPaise: number, status: string) {
    await prisma.$executeRaw`UPDATE "MetalBill" SET "paidPaise" = ${paidPaise}, "payStatus" = ${status}, "updatedAt" = NOW() WHERE id = ${id}`
}

export async function sqlInsertPayment(id: string, profileId: string, partyId: string, method: string, paise: number, ref?: string | null) {
    await prisma.$executeRaw`
        INSERT INTO "MetalPayment" (id, "profileId", "partyAccountId", method, paise, ref)
        VALUES (${id}, ${profileId}, ${partyId}, ${method}, ${paise}, ${ref ?? null})`
}

export async function sqlInsertAlloc(id: string, paymentId: string, billId: string, paise: number) {
    await prisma.$executeRaw`
        INSERT INTO "MetalAllocation" (id, "paymentId", "billId", paise)
        VALUES (${id}, ${paymentId}, ${billId}, ${paise})`
}

export async function sqlLastLedger(partyId: string) {
    const rows = await prisma.$queryRaw<{ paiseAfter: number; fineMgAfter: number }[]>`
        SELECT "paiseAfter", "fineMgAfter" FROM "PartyLedgerEntry" WHERE "partyAccountId" = ${partyId} ORDER BY at DESC LIMIT 1`
    return rows[0] ?? { paiseAfter: 0, fineMgAfter: 0 }
}

export async function sqlInsertLedger(input: {
    id: string
    partyAccountId: string
    kind: string
    paiseDelta: number
    paiseAfter: number
    billId?: string
    paymentId?: string
    key: string
}) {
    await prisma.$executeRaw`
        INSERT INTO "PartyLedgerEntry" (id, "partyAccountId", kind, "paiseDelta", "paiseAfter", "billId", "paymentId", "idempotencyKey")
        VALUES (${input.id}, ${input.partyAccountId}, ${input.kind}, ${input.paiseDelta}, ${input.paiseAfter}, ${input.billId ?? null}, ${input.paymentId ?? null}, ${input.key})
        ON CONFLICT ("partyAccountId", "idempotencyKey") DO NOTHING`
}

function asPaise(value: bigint | number | null | undefined) {
    if (value == null) return 0
    return typeof value === "bigint" ? Number(value) : value
}

export async function sqlCashSums(profileId: string, kind: string) {
    const rows = await prisma.$queryRaw<{ total: bigint | number | null; paid: bigint | number | null }[]>`
        SELECT COALESCE(SUM("totalPaise"), 0) AS total, COALESCE(SUM("paidPaise"), 0) AS paid
        FROM "MetalBill" WHERE "profileId" = ${profileId} AND kind = ${kind} AND "payStatus" IN ('UNPAID','PARTIAL')`
    return { total: asPaise(rows[0]?.total), paid: asPaise(rows[0]?.paid) }
}

export async function sqlAging(profileId: string, kind = "SALE") {
    return prisma.$queryRaw<(BillRow & { name: string; phone: string | null })[]>`
        SELECT b.id, b."profileId", b."partyAccountId", b.kind, b."k24PaisePer10g", b."totalPaise", b."paidPaise", b."payStatus", b."dueOn", b."publicToken", b."liftedAt", b."createdAt",
               p."displayName" AS name, p.phone
        FROM "MetalBill" b
        JOIN "PartyAccount" p ON p.id = b."partyAccountId"
        WHERE b."profileId" = ${profileId} AND b.kind = ${kind} AND b."payStatus" IN ('UNPAID','PARTIAL')
        ORDER BY b."createdAt" ASC`
}

export async function sqlBillByToken(token: string) {
    const bills = await prisma.$queryRaw<BillRow[]>`
        SELECT id, "profileId", "partyAccountId", kind, "k24PaisePer10g", "totalPaise", "paidPaise", "payStatus", "dueOn", "publicToken", "liftedAt", "createdAt"
        FROM "MetalBill" WHERE "publicToken" = ${token} LIMIT 1`
    const bill = bills[0]
    if (!bill) return null
    const lines = await prisma.$queryRaw<BillLineRow[]>`
        SELECT id, "billId", "lotId", title, "grossMg", "touchBpsBilled", "makingPaise", "linePaise"
        FROM "MetalBillLine" WHERE "billId" = ${bill.id}`
    const profiles = await prisma.profile.findUnique({ where: { id: bill.profileId }, select: { displayName: true, slug: true, isPublic: true } })
    return { bill, lines, profile: profiles }
}

export async function sqlMarkLifted(id: string, byProfileId: string) {
    const n = await prisma.$executeRaw`
        UPDATE "MetalBill" SET "liftedAt" = NOW(), "liftedByProfileId" = ${byProfileId}, "updatedAt" = NOW()
        WHERE id = ${id} AND "liftedAt" IS NULL`
    if (n === 0) throw new Error("This parcel was already lifted")
}

export async function sqlOpenBillsByIds(profileId: string, partyId: string, ids: string[]) {
    const rows: BillRow[] = []
    for (const id of ids) {
        const found = await prisma.$queryRaw<BillRow[]>`
            SELECT id, "profileId", "partyAccountId", kind, "k24PaisePer10g", "totalPaise", "paidPaise", "payStatus", "dueOn", "publicToken", "liftedAt", "createdAt"
            FROM "MetalBill" WHERE id = ${id} AND "profileId" = ${profileId} AND "partyAccountId" = ${partyId} AND "payStatus" IN ('UNPAID','PARTIAL') LIMIT 1`
        if (found[0]) rows.push(found[0])
    }
    return rows
}
