import { createHash, randomBytes } from "node:crypto"
import {
    OrderChannel,
    OrderEventActor,
    OrderEventKind,
    OrderLineStatus,
    OrderPayMethod,
    OrderPayStatus,
    OrderStatus,
    Prisma,
    PrismaClient,
} from "@prisma/client"
import { dishGroups } from "../../src/lib/dish-options"
import type { ModifierSnapshot } from "../../src/lib/restaurant-orders"

/**
 * Restaurant ProductPurchase backfill, version 1.
 *
 * Safety and determinism:
 * - No flag means dry-run. Writes require both --apply and
 *   --database=<the exact database name parsed from DATABASE_URL>.
 * - Candidates are only ProductPurchase rows whose product belongs to a
 *   profile with roleTemplate === "RESTAURANT" and createdAt < cutoff.
 * - Rows are partitioned by profile ID and trim/lower-cased visitor email,
 *   then ordered by createdAt and purchase ID.
 * - A row joins the current group only when its adjacent gap is <= 5 seconds
 *   and the resulting total group span is <= 60 seconds. Otherwise it starts
 *   a new group. Purchase ID is the deterministic timestamp tie-breaker.
 * - Quantity notes must match `xN` or `xN · modifier prose` in full. Modifier
 *   prose must be the exact `, `-joined option labels produced by extrasLabel;
 *   every label must map uniquely to the current dish catalog. Unsafe rows
 *   and groups are reported by one-way references, never by guest PII/prose.
 * - Product and modifier prices did not exist on ProductPurchase. The target
 *   snapshots therefore use current product/catalog prices, with the source
 *   and product update timestamp recorded in each BACKFILL event.
 * - Order.legacyGroupKey and OrderLine.legacyPurchaseId provide group/row
 *   idempotency. ProductPurchase rows are never updated or deleted.
 */

const BACKFILL_VERSION = 1
const GROUPING_ALGORITHM = "profile-email-adjacent-5s-span-60s-v1"
const QUANTITY_PARSER = "anchored-xN-middle-dot-v1"
const MODIFIER_PARSER = "exact-comma-space-current-catalog-labels-v1"
const ADJACENT_GAP_MS = 5_000
const MAX_GROUP_SPAN_MS = 60_000
const MAX_QUANTITY = 20
const MAX_MODIFIER_LABEL_LENGTH = 500
const POSTGRES_INT_MAX = 2_147_483_647
const MAX_TRANSACTION_ATTEMPTS = 5
const QUERY_CHUNK_SIZE = 500
const LEGACY_GROUP_NAMESPACE = `restaurant-product-purchase-backfill:v${BACKFILL_VERSION}`

const purchaseSelect = Prisma.validator<Prisma.ProductPurchaseSelect>()({
    id: true,
    productId: true,
    visitorEmail: true,
    visitorName: true,
    paymentId: true,
    status: true,
    payMethod: true,
    buyerNote: true,
    address: true,
    confirmedAt: true,
    createdAt: true,
    product: {
        select: {
            id: true,
            title: true,
            sku: true,
            category: true,
            priceCents: true,
            currency: true,
            updatedAt: true,
            profile: {
                select: {
                    id: true,
                    roleTemplate: true,
                    timezone: true,
                },
            },
        },
    },
})

type LegacyPurchase = Prisma.ProductPurchaseGetPayload<{ select: typeof purchaseSelect }>
type DatabaseClient = Prisma.TransactionClient

type CliOptions = {
    apply: boolean
    cutoff: Date
    expectedDatabase: string | null
    help: boolean
}

type ProvisionalGroup = {
    profileId: string
    canonicalEmail: string
    purchases: LegacyPurchase[]
    legacyGroupKey: string
    groupRef: string
}

type ProvenanceRecord = {
    orderId: string
    legacyLineIds: Array<string | null>
}

type ProvenanceIndex = {
    ordersByGroupKey: Map<string, ProvenanceRecord>
    orderIdByPurchaseId: Map<string, string>
}

type ProvenanceState =
    | { state: "new" }
    | { state: "already-applied"; orderId: string }
    | { state: "conflict"; reasons: string[] }

type RowDiagnostic = {
    purchaseRef: string
    reasons: string[]
}

type PlannedLine = {
    legacyPurchaseId: string
    purchaseRef: string
    productId: string
    titleSnapshot: string
    skuSnapshot: string | null
    productCategory: string | null
    qty: number
    unitPriceCents: number
    unitModifierCents: number
    modifiers: ModifierSnapshot[]
    modifiersLabel: string | null
    lineTotalCents: number
    status: OrderLineStatus
    createdAt: Date
    productUpdatedAt: Date
    legacyStatus: string
    modifierPriceSource: "NO_MODIFIER_PROSE" | "CURRENT_DISH_CATALOG_EXACT_LABEL_MATCH"
}

type SafeGroupPlan = {
    profileId: string
    purchases: LegacyPurchase[]
    purchaseIds: string[]
    legacyGroupKey: string
    groupRef: string
    sourceFingerprint: string
    businessDate: Date
    businessDateKey: string
    timezone: string
    channel: OrderChannel
    tableLabel: string | null
    guestName: string | null
    guestEmail: string
    paymentRef: string | null
    payMethod: OrderPayMethod | null
    status: OrderStatus
    payStatus: OrderPayStatus
    paidAt: Date | null
    statusMapping: "PENDING_TO_PLACED_UNPAID" | "COMPLETED_TO_PAID"
    placedAt: Date
    subtotalCents: number
    taxCents: 0
    totalCents: number
    currency: string
    lines: PlannedLine[]
}

type UnsafeGroupPlan = {
    groupRef: string
    purchaseRefs: string[]
    groupReasons: string[]
    rowDiagnostics: RowDiagnostic[]
}

type PlannedEntry =
    | { state: "eligible"; plan: SafeGroupPlan }
    | { state: "already-applied"; group: ProvisionalGroup; orderId: string }
    | { state: "unsafe"; group: ProvisionalGroup; diagnostic: UnsafeGroupPlan }
    | { state: "provenance-conflict"; group: ProvisionalGroup; reasons: string[] }

type ApplyResult =
    | { state: "created"; orderId: string; lines: number; events: number }
    | { state: "already-applied"; orderId: string }

class BackfillConflictError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "BackfillConflictError"
    }
}

function usage() {
    return [
        "Restaurant ProductPurchase backfill",
        "",
        "Default (read-only dry-run):",
        "  npx ts-node --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' scripts/one-off/backfill-restaurant-product-purchases.ts [--cutoff=<ISO-8601>]",
        "",
        "Apply (writes only to the explicitly acknowledged database):",
        "  npx ts-node --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' scripts/one-off/backfill-restaurant-product-purchases.ts --apply --database=<exact-db-name> --cutoff=<ISO-8601>",
        "",
        "Flags:",
        "  --dry-run             Explicit dry-run (also the default).",
        "  --apply               Enable transactional writes.",
        "  --database=<name>     Must exactly match DATABASE_URL for --apply.",
        "  --cutoff=<ISO-8601>   Include rows with createdAt strictly before this instant.",
        "  --help                 Print this help.",
        "",
        "Unknown, duplicate, or conflicting flags are rejected.",
    ].join("\n")
}

function parseCliOptions(args: string[]): CliOptions {
    let apply = false
    let explicitDryRun = false
    let cutoff: Date | null = null
    let expectedDatabase: string | null = null
    let help = false
    const seen = new Set<string>()

    for (const arg of args) {
        if (arg === "--apply") {
            if (seen.has("apply")) throw new Error("Duplicate --apply flag.")
            seen.add("apply")
            apply = true
            continue
        }
        if (arg === "--dry-run") {
            if (seen.has("dry-run")) throw new Error("Duplicate --dry-run flag.")
            seen.add("dry-run")
            explicitDryRun = true
            continue
        }
        if (arg === "--help") {
            if (seen.has("help")) throw new Error("Duplicate --help flag.")
            seen.add("help")
            help = true
            continue
        }
        if (arg.startsWith("--cutoff=")) {
            if (seen.has("cutoff")) throw new Error("Duplicate --cutoff flag.")
            seen.add("cutoff")
            const raw = arg.slice("--cutoff=".length)
            if (!raw || !/(?:Z|[+-]\d{2}:\d{2})$/u.test(raw)) {
                throw new Error("--cutoff must be an absolute ISO-8601 timestamp with Z or an offset.")
            }
            const parsed = new Date(raw)
            if (Number.isNaN(parsed.getTime())) throw new Error("--cutoff is not a valid timestamp.")
            cutoff = parsed
            continue
        }
        if (arg.startsWith("--database=")) {
            if (seen.has("database")) throw new Error("Duplicate --database flag.")
            seen.add("database")
            expectedDatabase = decodeURIComponent(arg.slice("--database=".length)).trim()
            if (!expectedDatabase) throw new Error("--database cannot be empty.")
            continue
        }
        throw new Error(`Unknown argument: ${arg}`)
    }

    if (apply && explicitDryRun) throw new Error("--apply and --dry-run cannot be combined.")
    if (apply && !expectedDatabase) {
        throw new Error("--apply requires --database=<exact-db-name>.")
    }

    return {
        apply,
        cutoff: cutoff ?? new Date(),
        expectedDatabase,
        help,
    }
}

function databaseNameFromUrl(rawUrl: string) {
    let parsed: URL
    try {
        parsed = new URL(rawUrl)
    } catch {
        throw new Error("DATABASE_URL is not a valid URL.")
    }
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
        throw new Error("This backfill only supports PostgreSQL DATABASE_URL values.")
    }
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, "").split("/")[0] ?? "").trim()
    if (!databaseName) throw new Error("DATABASE_URL does not contain a database name.")
    return databaseName
}

function sha256(value: string) {
    return createHash("sha256").update(value).digest("hex")
}

function purchaseRef(id: string) {
    return sha256(`purchase:${id}`).slice(0, 12)
}

function normalizeNullable(value: string | null | undefined) {
    const normalized = value?.trim() ?? ""
    return normalized || null
}

function canonicalizeEmail(value: string) {
    return value.trim().toLowerCase()
}

function compareStrings(a: string, b: string) {
    return a < b ? -1 : a > b ? 1 : 0
}

function comparePurchases(a: LegacyPurchase, b: LegacyPurchase) {
    return (
        compareStrings(a.product.profile.id, b.product.profile.id) ||
        compareStrings(canonicalizeEmail(a.visitorEmail), canonicalizeEmail(b.visitorEmail)) ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        compareStrings(a.id, b.id)
    )
}

function makeLegacyGroupKey(profileId: string, purchaseIds: string[]) {
    const payload = JSON.stringify({
        namespace: LEGACY_GROUP_NAMESPACE,
        groupingAlgorithm: GROUPING_ALGORITHM,
        profileId,
        purchaseIds: [...purchaseIds].sort(compareStrings),
    })
    return `rppb:v${BACKFILL_VERSION}:${sha256(payload)}`
}

function buildProvisionalGroups(input: LegacyPurchase[]) {
    const rows = [...input].sort(comparePurchases)
    const groups: ProvisionalGroup[] = []

    for (const purchase of rows) {
        const profileId = purchase.product.profile.id
        const canonicalEmail = canonicalizeEmail(purchase.visitorEmail)
        const current = groups.at(-1)
        const previous = current?.purchases.at(-1)
        const samePartition = Boolean(
            current && current.profileId === profileId && current.canonicalEmail === canonicalEmail,
        )
        const adjacentGap = previous ? purchase.createdAt.getTime() - previous.createdAt.getTime() : Infinity
        const totalSpan = current
            ? purchase.createdAt.getTime() - current.purchases[0].createdAt.getTime()
            : Infinity
        const joinsCurrent =
            samePartition &&
            adjacentGap >= 0 &&
            adjacentGap <= ADJACENT_GAP_MS &&
            totalSpan <= MAX_GROUP_SPAN_MS

        if (joinsCurrent && current) {
            current.purchases.push(purchase)
            current.legacyGroupKey = makeLegacyGroupKey(
                current.profileId,
                current.purchases.map((row) => row.id),
            )
            current.groupRef = sha256(current.legacyGroupKey).slice(0, 12)
            continue
        }

        const legacyGroupKey = makeLegacyGroupKey(profileId, [purchase.id])
        groups.push({
            profileId,
            canonicalEmail,
            purchases: [purchase],
            legacyGroupKey,
            groupRef: sha256(legacyGroupKey).slice(0, 12),
        })
    }

    return groups
}

function chunks<T>(values: T[], size = QUERY_CHUNK_SIZE) {
    const result: T[][] = []
    for (let index = 0; index < values.length; index += size) {
        result.push(values.slice(index, index + size))
    }
    return result
}

async function loadProvenanceIndex(db: DatabaseClient, groups: ProvisionalGroup[]) {
    const index: ProvenanceIndex = {
        ordersByGroupKey: new Map(),
        orderIdByPurchaseId: new Map(),
    }
    const groupKeys = [...new Set(groups.map((group) => group.legacyGroupKey))]
    const purchaseIds = [...new Set(groups.flatMap((group) => group.purchases.map((row) => row.id)))]

    for (const keyChunk of chunks(groupKeys)) {
        const orders = await db.order.findMany({
            where: { legacyGroupKey: { in: keyChunk } },
            select: {
                id: true,
                legacyGroupKey: true,
                lines: { select: { legacyPurchaseId: true } },
            },
        })
        for (const order of orders) {
            if (!order.legacyGroupKey) continue
            index.ordersByGroupKey.set(order.legacyGroupKey, {
                orderId: order.id,
                legacyLineIds: order.lines.map((line) => line.legacyPurchaseId),
            })
        }
    }

    for (const idChunk of chunks(purchaseIds)) {
        const lines = await db.orderLine.findMany({
            where: { legacyPurchaseId: { in: idChunk } },
            select: { legacyPurchaseId: true, orderId: true },
        })
        for (const line of lines) {
            if (line.legacyPurchaseId) index.orderIdByPurchaseId.set(line.legacyPurchaseId, line.orderId)
        }
    }

    return index
}

function classifyProvenance(group: ProvisionalGroup, index: ProvenanceIndex): ProvenanceState {
    const sourceIds = group.purchases.map((row) => row.id).sort(compareStrings)
    const keyedOrder = index.ordersByGroupKey.get(group.legacyGroupKey)
    const mappedOrderIds = new Set(
        sourceIds.map((id) => index.orderIdByPurchaseId.get(id)).filter((id): id is string => Boolean(id)),
    )
    const keyedLineIds = keyedOrder?.legacyLineIds ?? []
    const keyedNonNullLineIds = keyedLineIds.filter((id): id is string => Boolean(id)).sort(compareStrings)
    const membershipMatches =
        Boolean(keyedOrder) &&
        keyedLineIds.length === sourceIds.length &&
        keyedNonNullLineIds.length === sourceIds.length &&
        keyedNonNullLineIds.every((id, index) => id === sourceIds[index])
    const lineMappingsMatch =
        Boolean(keyedOrder) && mappedOrderIds.size === 1 && mappedOrderIds.has(keyedOrder!.orderId)

    if (membershipMatches && lineMappingsMatch && keyedOrder) {
        return { state: "already-applied", orderId: keyedOrder.orderId }
    }
    if (!keyedOrder && mappedOrderIds.size === 0) return { state: "new" }

    const reasons: string[] = []
    if (keyedOrder && !membershipMatches) reasons.push("LEGACY_GROUP_MEMBERSHIP_MISMATCH")
    if (mappedOrderIds.size > 1) reasons.push("LEGACY_LINES_SPLIT_ACROSS_ORDERS")
    if (keyedOrder && mappedOrderIds.size > 0 && !lineMappingsMatch) {
        reasons.push("LEGACY_LINE_POINTS_TO_DIFFERENT_ORDER")
    }
    if (!keyedOrder && mappedOrderIds.size > 0) reasons.push("LEGACY_LINE_EXISTS_WITHOUT_GROUP_KEY")
    if (keyedOrder && mappedOrderIds.size === 0) reasons.push("LEGACY_GROUP_EXISTS_WITHOUT_MATCHING_LINES")
    return { state: "conflict", reasons: [...new Set(reasons)].sort(compareStrings) }
}

async function classifyCurrentProvenance(db: DatabaseClient, group: ProvisionalGroup) {
    const index = await loadProvenanceIndex(db, [group])
    return classifyProvenance(group, index)
}

function sourceFingerprint(purchases: LegacyPurchase[]) {
    const canonical = [...purchases].sort(comparePurchases).map((row) => ({
        id: row.id,
        productId: row.productId,
        visitorEmail: row.visitorEmail,
        visitorName: row.visitorName,
        paymentId: row.paymentId,
        status: row.status,
        payMethod: row.payMethod,
        buyerNote: row.buyerNote,
        address: row.address,
        confirmedAt: row.confirmedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        product: {
            id: row.product.id,
            title: row.product.title,
            sku: row.product.sku,
            category: row.product.category,
            priceCents: row.product.priceCents,
            currency: row.product.currency,
            updatedAt: row.product.updatedAt.toISOString(),
            profile: row.product.profile,
        },
    }))
    return sha256(JSON.stringify(canonical))
}

function datePartsInTimeZone(timezone: string, date: Date) {
    let parts: Intl.DateTimeFormatPart[]
    try {
        parts = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(date)
    } catch {
        throw new Error("INVALID_RESTAURANT_TIMEZONE")
    }
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    if (!values.year || !values.month || !values.day) throw new Error("INVALID_RESTAURANT_TIMEZONE")
    const key = `${values.year}-${values.month}-${values.day}`
    return { key, date: new Date(`${key}T00:00:00.000Z`) }
}

function uniqueNormalized(values: Array<string | null | undefined>, transform?: (value: string) => string) {
    return new Set(values.map((value) => {
        const normalized = normalizeNullable(value)
        return normalized === null ? "<null>" : transform ? transform(normalized) : normalized
    }))
}

function parseLegacyLine(row: LegacyPurchase):
    | { ok: true; value: Omit<PlannedLine, "lineTotalCents" | "status"> }
    | { ok: false; reasons: string[] } {
    const reasons: string[] = []
    const note = row.buyerNote?.trim() ?? ""
    const match = /^x([1-9]\d*)(?: · (.+))?$/u.exec(note)
    if (!match) {
        return { ok: false, reasons: [row.buyerNote == null ? "QUANTITY_NOTE_MISSING" : "QUANTITY_MODIFIER_GRAMMAR_UNSAFE"] }
    }

    const qty = Number(match[1])
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > MAX_QUANTITY) {
        reasons.push("QUANTITY_OUT_OF_RANGE")
    }

    const modifiersLabel = match[2]?.trim() || null
    if (modifiersLabel && modifiersLabel.length > MAX_MODIFIER_LABEL_LENGTH) {
        reasons.push("MODIFIER_PROSE_TOO_LONG")
    }
    if (modifiersLabel && /[\u0000-\u001f\u007f]/u.test(modifiersLabel)) {
        reasons.push("MODIFIER_PROSE_CONTAINS_CONTROL_CHARACTER")
    }

    const groups = dishGroups(row.product.category, row.product.title)
    const snapshots: ModifierSnapshot[] = []
    const selectedByGroup = new Map<string, number>()
    const selectedKeys = new Set<string>()

    if (modifiersLabel) {
        const labels = modifiersLabel.split(", ")
        if (labels.some((label) => !label || label !== label.trim())) {
            reasons.push("MODIFIER_PROSE_SEPARATOR_UNSAFE")
        } else {
            for (const label of labels) {
                const matches = groups.flatMap((group) => group.options
                    .filter((option) => option.name === label)
                    .map((option) => ({ group, option })))
                if (matches.length === 0) {
                    reasons.push("MODIFIER_LABEL_NOT_IN_CURRENT_CATALOG")
                    continue
                }
                if (matches.length > 1) {
                    reasons.push("MODIFIER_LABEL_AMBIGUOUS_IN_CURRENT_CATALOG")
                    continue
                }
                const { group, option } = matches[0]
                const selectionKey = `${group.id}\u0000${option.id}`
                if (selectedKeys.has(selectionKey)) {
                    reasons.push("MODIFIER_SELECTION_DUPLICATED")
                    continue
                }
                selectedKeys.add(selectionKey)
                selectedByGroup.set(group.id, (selectedByGroup.get(group.id) ?? 0) + 1)
                snapshots.push({
                    groupId: group.id,
                    group: group.label,
                    optionId: option.id,
                    label: option.name,
                    priceCents: option.priceCents,
                })
            }
        }
    }

    for (const group of groups) {
        const selected = selectedByGroup.get(group.id) ?? 0
        if (selected > group.max) reasons.push("MODIFIER_GROUP_MAX_EXCEEDED")
        if (group.required && selected === 0) reasons.push("REQUIRED_MODIFIER_NOT_RECOVERABLE")
    }

    const unitModifierCents = snapshots.reduce((sum, snapshot) => sum + snapshot.priceCents, 0)
    if (!Number.isSafeInteger(unitModifierCents) || unitModifierCents < 0 || unitModifierCents > POSTGRES_INT_MAX) {
        reasons.push("MODIFIER_PRICE_OUT_OF_RANGE")
    }
    if (
        !Number.isInteger(row.product.priceCents) ||
        row.product.priceCents < 0 ||
        row.product.priceCents > POSTGRES_INT_MAX
    ) {
        reasons.push("PRODUCT_PRICE_OUT_OF_RANGE")
    }

    if (reasons.length > 0) return { ok: false, reasons: [...new Set(reasons)].sort(compareStrings) }

    return {
        ok: true,
        value: {
            legacyPurchaseId: row.id,
            purchaseRef: purchaseRef(row.id),
            productId: row.productId,
            titleSnapshot: row.product.title,
            skuSnapshot: normalizeNullable(row.product.sku),
            productCategory: normalizeNullable(row.product.category),
            qty,
            unitPriceCents: row.product.priceCents,
            unitModifierCents,
            modifiers: snapshots,
            modifiersLabel,
            createdAt: row.createdAt,
            productUpdatedAt: row.product.updatedAt,
            legacyStatus: row.status,
            modifierPriceSource: modifiersLabel
                ? "CURRENT_DISH_CATALOG_EXACT_LABEL_MATCH"
                : "NO_MODIFIER_PROSE",
        },
    }
}

function validateGroup(group: ProvisionalGroup):
    | { safe: true; plan: SafeGroupPlan }
    | { safe: false; diagnostic: UnsafeGroupPlan } {
    const groupReasons: string[] = []
    const rowDiagnostics: RowDiagnostic[] = []
    const first = group.purchases[0]
    const purchaseRefs = group.purchases.map((row) => purchaseRef(row.id))

    if (!group.canonicalEmail) groupReasons.push("VISITOR_EMAIL_EMPTY")
    if (/\s/u.test(group.canonicalEmail) || !group.canonicalEmail.includes("@")) {
        groupReasons.push("VISITOR_EMAIL_UNSAFE")
    }
    if (group.purchases.some((row) => row.product.profile.id !== group.profileId)) {
        groupReasons.push("MIXED_PROFILE")
    }
    if (group.purchases.some((row) => row.product.profile.roleTemplate !== "RESTAURANT")) {
        groupReasons.push("NON_RESTAURANT_SOURCE")
    }

    const visitorNames = uniqueNormalized(group.purchases.map((row) => row.visitorName))
    if (visitorNames.size > 1) groupReasons.push("MIXED_VISITOR_NAME")
    const addresses = uniqueNormalized(group.purchases.map((row) => row.address))
    if (addresses.size > 1) groupReasons.push("MIXED_ADDRESS_OR_TABLE_LABEL")
    const paymentRefs = uniqueNormalized(group.purchases.map((row) => row.paymentId))
    if (paymentRefs.size > 1) groupReasons.push("MIXED_PAYMENT_REFERENCE")
    const currencies = uniqueNormalized(
        group.purchases.map((row) => row.product.currency),
        (value) => value.toUpperCase(),
    )
    if (currencies.size !== 1 || currencies.has("<null>")) groupReasons.push("MIXED_OR_EMPTY_CURRENCY")
    const payMethods = uniqueNormalized(group.purchases.map((row) => row.payMethod), (value) => value.toUpperCase())
    if (payMethods.size > 1) groupReasons.push("MIXED_PAY_METHOD")
    const statuses = uniqueNormalized(group.purchases.map((row) => row.status), (value) => value.toUpperCase())
    if (statuses.size !== 1 || statuses.has("<null>")) groupReasons.push("MIXED_OR_EMPTY_LEGACY_STATUS")

    const rawPayMethod = normalizeNullable(first.payMethod)?.toUpperCase() ?? null
    const payMethod = rawPayMethod && Object.values(OrderPayMethod).includes(rawPayMethod as OrderPayMethod)
        ? rawPayMethod as OrderPayMethod
        : null
    if (rawPayMethod && payMethod === null) groupReasons.push("UNSUPPORTED_PAY_METHOD")

    const legacyStatus = normalizeNullable(first.status)?.toUpperCase() ?? ""
    let status: OrderStatus = OrderStatus.PLACED
    let payStatus: OrderPayStatus = OrderPayStatus.UNPAID
    let paidAt: Date | null = null
    let lineStatus: OrderLineStatus = OrderLineStatus.QUEUED
    let statusMapping: SafeGroupPlan["statusMapping"] = "PENDING_TO_PLACED_UNPAID"
    if (legacyStatus === "PENDING") {
        // Defaults are the least speculative mapping.
    } else if (legacyStatus === "COMPLETED") {
        if (group.purchases.some((row) => row.confirmedAt === null)) {
            groupReasons.push("COMPLETED_WITHOUT_CONFIRMED_AT")
        } else {
            status = OrderStatus.PAID
            payStatus = OrderPayStatus.PAID
            lineStatus = OrderLineStatus.SERVED
            paidAt = new Date(Math.max(...group.purchases.map((row) => row.confirmedAt!.getTime())))
            statusMapping = "COMPLETED_TO_PAID"
        }
    } else if (statuses.size === 1) {
        groupReasons.push("UNSUPPORTED_LEGACY_STATUS")
    }

    let businessDate: Date | null = null
    let businessDateKey = ""
    try {
        const result = datePartsInTimeZone(first.product.profile.timezone, first.createdAt)
        businessDate = result.date
        businessDateKey = result.key
    } catch {
        groupReasons.push("INVALID_RESTAURANT_TIMEZONE")
    }

    const parsedLines: Array<Omit<PlannedLine, "lineTotalCents" | "status">> = []
    for (const row of group.purchases) {
        const parsed = parseLegacyLine(row)
        if (parsed.ok === false) {
            rowDiagnostics.push({ purchaseRef: purchaseRef(row.id), reasons: parsed.reasons })
        } else {
            parsedLines.push(parsed.value)
        }
    }

    const lines: PlannedLine[] = []
    let subtotal = BigInt(0)
    for (const line of parsedLines) {
        const lineTotal = BigInt(line.unitPriceCents + line.unitModifierCents) * BigInt(line.qty)
        if (lineTotal < BigInt(0) || lineTotal > BigInt(POSTGRES_INT_MAX)) {
            rowDiagnostics.push({ purchaseRef: line.purchaseRef, reasons: ["LINE_TOTAL_OUT_OF_RANGE"] })
            continue
        }
        subtotal += lineTotal
        lines.push({ ...line, lineTotalCents: Number(lineTotal), status: lineStatus })
    }
    if (subtotal > BigInt(POSTGRES_INT_MAX)) groupReasons.push("ORDER_TOTAL_OUT_OF_RANGE")

    if (groupReasons.length > 0 || rowDiagnostics.length > 0 || lines.length !== group.purchases.length || !businessDate) {
        return {
            safe: false,
            diagnostic: {
                groupRef: group.groupRef,
                purchaseRefs,
                groupReasons: [...new Set(groupReasons)].sort(compareStrings),
                rowDiagnostics: rowDiagnostics.sort((a, b) => compareStrings(a.purchaseRef, b.purchaseRef)),
            },
        }
    }

    const tableLabel = normalizeNullable(first.address)
    const currency = first.product.currency.trim().toUpperCase()
    return {
        safe: true,
        plan: {
            profileId: group.profileId,
            purchases: group.purchases,
            purchaseIds: group.purchases.map((row) => row.id),
            legacyGroupKey: group.legacyGroupKey,
            groupRef: group.groupRef,
            sourceFingerprint: sourceFingerprint(group.purchases),
            businessDate,
            businessDateKey,
            timezone: first.product.profile.timezone,
            channel: tableLabel ? OrderChannel.DINE_IN : OrderChannel.TAKEAWAY,
            tableLabel,
            guestName: normalizeNullable(first.visitorName),
            guestEmail: first.visitorEmail.trim(),
            paymentRef: normalizeNullable(first.paymentId),
            payMethod,
            status,
            payStatus,
            paidAt,
            statusMapping,
            placedAt: first.createdAt,
            subtotalCents: Number(subtotal),
            taxCents: 0,
            totalCents: Number(subtotal),
            currency,
            lines,
        },
    }
}

function planEntries(groups: ProvisionalGroup[], provenance: ProvenanceIndex) {
    return groups.map<PlannedEntry>((group) => {
        const state = classifyProvenance(group, provenance)
        if (state.state === "already-applied") {
            return { state: "already-applied", group, orderId: state.orderId }
        }
        if (state.state === "conflict") {
            return { state: "provenance-conflict", group, reasons: state.reasons }
        }
        const validation = validateGroup(group)
        if (validation.safe === false) return { state: "unsafe", group, diagnostic: validation.diagnostic }
        return { state: "eligible", plan: validation.plan }
    })
}

function increment(record: Record<string, number>, key: string, by = 1) {
    record[key] = (record[key] ?? 0) + by
}

function sanitizedPlanReport(
    databaseName: string,
    options: CliOptions,
    candidates: LegacyPurchase[],
    groups: ProvisionalGroup[],
    entries: PlannedEntry[],
    applyResults: ApplyResult[] = [],
) {
    const eligible = entries.filter((entry): entry is Extract<PlannedEntry, { state: "eligible" }> => entry.state === "eligible")
    const already = entries.filter((entry): entry is Extract<PlannedEntry, { state: "already-applied" }> => entry.state === "already-applied")
    const unsafe = entries.filter((entry): entry is Extract<PlannedEntry, { state: "unsafe" }> => entry.state === "unsafe")
    const conflicts = entries.filter((entry): entry is Extract<PlannedEntry, { state: "provenance-conflict" }> => entry.state === "provenance-conflict")
    const unsafeReasonCounts: Record<string, number> = {}
    for (const entry of unsafe) {
        for (const reason of entry.diagnostic.groupReasons) increment(unsafeReasonCounts, reason)
        for (const row of entry.diagnostic.rowDiagnostics) {
            for (const reason of row.reasons) increment(unsafeReasonCounts, reason)
        }
    }
    const conflictReasonCounts: Record<string, number> = {}
    for (const entry of conflicts) {
        for (const reason of entry.reasons) increment(conflictReasonCounts, reason)
    }
    const groupSizeDistribution: Record<string, number> = {}
    for (const group of groups) increment(groupSizeDistribution, String(group.purchases.length))
    const eligibleCurrencyTotals = new Map<string, bigint>()
    for (const entry of eligible) {
        eligibleCurrencyTotals.set(
            entry.plan.currency,
            (eligibleCurrencyTotals.get(entry.plan.currency) ?? BigInt(0)) + BigInt(entry.plan.totalCents),
        )
    }
    const gapValues = groups.flatMap((group) => group.purchases.slice(1).map((row, index) =>
        row.createdAt.getTime() - group.purchases[index].createdAt.getTime()))
    const groupSpans = groups.map((group) =>
        group.purchases.at(-1)!.createdAt.getTime() - group.purchases[0].createdAt.getTime())
    const createdResults = applyResults.filter((result) => result.state === "created")
    const racedAlreadyResults = applyResults.filter((result) => result.state === "already-applied")

    return {
        backfillVersion: BACKFILL_VERSION,
        mode: options.apply ? "apply" : "dry-run",
        database: databaseName,
        cutoffExclusive: options.cutoff.toISOString(),
        sourceRowsPreserved: true,
        policy: {
            restaurantScope: "product.profile.roleTemplate === RESTAURANT",
            groupingAlgorithm: GROUPING_ALGORITHM,
            partition: ["profileId", "trim(lower(visitorEmail))"],
            ordering: ["profileId", "canonicalEmail", "createdAt", "purchaseId"],
            adjacentGapMaxMs: ADJACENT_GAP_MS,
            totalGroupSpanMaxMs: MAX_GROUP_SPAN_MS,
            quantityParser: QUANTITY_PARSER,
            modifierParser: MODIFIER_PARSER,
            basePriceInference: "CURRENT_DIGITAL_PRODUCT_PRICE_AT_BACKFILL",
            modifierPriceInference: "CURRENT_DISH_CATALOG_EXACT_LABEL_MATCH_AT_BACKFILL",
            taxInference: "ZERO_NO_LEGACY_TAX_SNAPSHOT",
        },
        counts: {
            candidatePurchases: candidates.length,
            provisionalGroups: groups.length,
            eligiblePurchases: eligible.reduce((sum, entry) => sum + entry.plan.lines.length, 0),
            eligibleGroups: eligible.length,
            alreadyAppliedPurchases: already.reduce((sum, entry) => sum + entry.group.purchases.length, 0),
            alreadyAppliedGroups: already.length,
            unsafePurchases: unsafe.reduce((sum, entry) => sum + entry.group.purchases.length, 0),
            unsafeGroups: unsafe.length,
            provenanceConflictPurchases: conflicts.reduce((sum, entry) => sum + entry.group.purchases.length, 0),
            provenanceConflictGroups: conflicts.length,
            wouldCreateOrders: eligible.length,
            wouldCreateLines: eligible.reduce((sum, entry) => sum + entry.plan.lines.length, 0),
            wouldCreateEvents: eligible.reduce((sum, entry) => sum + entry.plan.lines.length, 0),
            currentBasePriceInferences: eligible.reduce((sum, entry) => sum + entry.plan.lines.length, 0),
            currentModifierPriceInferences: eligible.reduce(
                (sum, entry) => sum + entry.plan.lines.filter((line) => line.modifiers.length > 0).length,
                0,
            ),
        },
        distributions: {
            groupSizes: groupSizeDistribution,
            maximumAdjacentGapMs: gapValues.length ? Math.max(...gapValues) : 0,
            maximumGroupSpanMs: groupSpans.length ? Math.max(...groupSpans) : 0,
            eligibleTotalsCentsByCurrency: Object.fromEntries(
                [...eligibleCurrencyTotals].sort(([a], [b]) => compareStrings(a, b)).map(([currency, total]) => [currency, total.toString()]),
            ),
        },
        unsafeReasonCounts,
        unsafeRows: unsafe.flatMap((entry) => entry.diagnostic.rowDiagnostics.map((row) => ({
            groupRef: entry.group.groupRef,
            purchaseRef: row.purchaseRef,
            reasons: row.reasons,
        }))),
        unsafeGroups: unsafe.map((entry) => ({
            groupRef: entry.group.groupRef,
            purchaseCount: entry.group.purchases.length,
            reasons: entry.diagnostic.groupReasons,
        })),
        provenanceConflictReasonCounts: conflictReasonCounts,
        provenanceConflicts: conflicts.map((entry) => ({
            groupRef: entry.group.groupRef,
            purchaseCount: entry.group.purchases.length,
            reasons: entry.reasons,
        })),
        apply: options.apply ? {
            createdOrders: createdResults.length,
            createdLines: createdResults.reduce((sum, result) => sum + result.lines, 0),
            createdEvents: createdResults.reduce((sum, result) => sum + result.events, 0),
            becameAlreadyAppliedDuringRun: racedAlreadyResults.length,
        } : null,
    }
}

async function allocateDailyNumber(
    tx: Prisma.TransactionClient,
    profileId: string,
    businessDate: Date,
) {
    const now = new Date()
    const rows = await tx.$queryRaw<Array<{ value: number }>>(Prisma.sql`
        INSERT INTO "OrderCounter" ("profileId", "businessDate", "value", "updatedAt")
        SELECT ${profileId}, ${businessDate}, COALESCE(MAX("number"), 0) + 1, ${now}
        FROM "Order"
        WHERE "profileId" = ${profileId}
          AND "businessDate" = ${businessDate}
        ON CONFLICT ("profileId", "businessDate") DO UPDATE
        SET "value" = GREATEST("OrderCounter"."value" + 1, EXCLUDED."value"),
            "updatedAt" = EXCLUDED."updatedAt"
        RETURNING "value"
    `)
    const value = rows[0]?.value
    if (!Number.isInteger(value) || value < 1 || value > POSTGRES_INT_MAX) {
        throw new Error("Daily order counter returned an invalid number.")
    }
    return value
}

function eventMetadata(plan: SafeGroupPlan, line: PlannedLine, appliedAt: Date): Prisma.InputJsonObject {
    return {
        backfillVersion: BACKFILL_VERSION,
        groupingAlgorithm: GROUPING_ALGORITHM,
        legacyGroupKey: plan.legacyGroupKey,
        source: {
            model: "ProductPurchase",
            legacyPurchaseId: line.legacyPurchaseId,
            sourceCreatedAt: line.createdAt.toISOString(),
            legacyStatus: line.legacyStatus,
        },
        quantityInference: {
            inferred: true,
            parser: QUANTITY_PARSER,
            source: "ProductPurchase.buyerNote",
            quantity: line.qty,
        },
        priceInference: {
            inferred: true,
            basePriceSource: "CURRENT_DIGITAL_PRODUCT_PRICE_AT_BACKFILL",
            modifierPriceSource: line.modifierPriceSource,
            currencySource: "CURRENT_DIGITAL_PRODUCT_CURRENCY_AT_BACKFILL",
            taxSource: "ZERO_NO_LEGACY_TAX_SNAPSHOT",
            unitPriceCents: line.unitPriceCents,
            unitModifierCents: line.unitModifierCents,
            currency: plan.currency,
            productUpdatedAt: line.productUpdatedAt.toISOString(),
            inferredAt: appliedAt.toISOString(),
        },
        modifierInference: {
            parser: MODIFIER_PARSER,
            currentCatalogExactMatches: line.modifiers.length,
            structuredSnapshotsInferred: line.modifiers.length > 0,
        },
        snapshotInference: {
            titleAndSkuSource: "CURRENT_DIGITAL_PRODUCT_AT_BACKFILL",
            productCategoryAtBackfill: line.productCategory,
        },
        statusInference: {
            mapping: plan.statusMapping,
            targetOrderStatus: plan.status,
            targetPayStatus: plan.payStatus,
            targetLineStatus: line.status,
        },
        businessDateInference: {
            source: "CURRENT_PROFILE_TIMEZONE_WITH_LEGACY_CREATED_AT",
            timezone: plan.timezone,
            businessDate: plan.businessDateKey,
        },
    }
}

async function applyOneGroup(prisma: PrismaClient, initialPlan: SafeGroupPlan): Promise<ApplyResult> {
    const group: ProvisionalGroup = {
        profileId: initialPlan.profileId,
        canonicalEmail: canonicalizeEmail(initialPlan.guestEmail),
        purchases: initialPlan.purchases,
        legacyGroupKey: initialPlan.legacyGroupKey,
        groupRef: initialPlan.groupRef,
    }

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
        try {
            return await prisma.$transaction(async (tx) => {
                const provenance = await classifyCurrentProvenance(tx, group)
                if (provenance.state === "already-applied") {
                    return { state: "already-applied", orderId: provenance.orderId }
                }
                if (provenance.state === "conflict") {
                    throw new BackfillConflictError(
                        `Provenance conflict for group ${group.groupRef}: ${provenance.reasons.join(", ")}`,
                    )
                }

                const currentRows = await tx.productPurchase.findMany({
                    where: { id: { in: initialPlan.purchaseIds } },
                    select: purchaseSelect,
                })
                if (currentRows.length !== initialPlan.purchaseIds.length) {
                    throw new BackfillConflictError(`Source rows changed for group ${group.groupRef}.`)
                }
                const rebuiltGroups = buildProvisionalGroups(currentRows)
                if (rebuiltGroups.length !== 1 || rebuiltGroups[0].legacyGroupKey !== initialPlan.legacyGroupKey) {
                    throw new BackfillConflictError(`Grouping inputs changed for group ${group.groupRef}.`)
                }
                const validation = validateGroup(rebuiltGroups[0])
                if (!validation.safe) {
                    throw new BackfillConflictError(`Source validation changed for group ${group.groupRef}.`)
                }
                const plan = validation.plan
                if (plan.sourceFingerprint !== initialPlan.sourceFingerprint) {
                    throw new BackfillConflictError(`Source/product snapshots changed for group ${group.groupRef}.`)
                }

                const number = await allocateDailyNumber(tx, plan.profileId, plan.businessDate)
                const appliedAt = new Date()
                const order = await tx.order.create({
                    data: {
                        profileId: plan.profileId,
                        publicToken: randomBytes(24).toString("base64url"),
                        legacyGroupKey: plan.legacyGroupKey,
                        number,
                        businessDate: plan.businessDate,
                        channel: plan.channel,
                        tableLabel: plan.tableLabel,
                        status: plan.status,
                        guestName: plan.guestName,
                        guestEmail: plan.guestEmail,
                        subtotalCents: plan.subtotalCents,
                        taxCents: plan.taxCents,
                        totalCents: plan.totalCents,
                        currency: plan.currency,
                        payMethod: plan.payMethod,
                        payStatus: plan.payStatus,
                        paidAt: plan.paidAt,
                        paymentRef: plan.paymentRef,
                        placedAt: plan.placedAt,
                    },
                    select: { id: true },
                })

                for (const line of plan.lines) {
                    const createdLine = await tx.orderLine.create({
                        data: {
                            orderId: order.id,
                            productId: line.productId,
                            titleSnapshot: line.titleSnapshot,
                            skuSnapshot: line.skuSnapshot,
                            qty: line.qty,
                            unitPriceCents: line.unitPriceCents,
                            unitModifierCents: line.unitModifierCents,
                            modifiers: line.modifiers.length > 0
                                ? line.modifiers as unknown as Prisma.InputJsonValue
                                : undefined,
                            modifiersLabel: line.modifiersLabel,
                            lineTotalCents: line.lineTotalCents,
                            status: line.status,
                            legacyPurchaseId: line.legacyPurchaseId,
                            createdAt: line.createdAt,
                        },
                        select: { id: true },
                    })
                    await tx.orderEvent.create({
                        data: {
                            orderId: order.id,
                            orderLineId: createdLine.id,
                            kind: OrderEventKind.BACKFILL,
                            from: null,
                            to: plan.status,
                            actor: OrderEventActor.SYSTEM,
                            metadata: eventMetadata(plan, line, appliedAt),
                            at: appliedAt,
                        },
                    })
                }

                return {
                    state: "created",
                    orderId: order.id,
                    lines: plan.lines.length,
                    events: plan.lines.length,
                }
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                maxWait: 10_000,
                timeout: 30_000,
            })
        } catch (error) {
            if (error instanceof BackfillConflictError) throw error
            const isKnown = error instanceof Prisma.PrismaClientKnownRequestError
            const meta = isKnown
                ? error.meta as { code?: unknown; message?: unknown } | undefined
                : undefined
            const serializationFailure = isKnown && (
                error.code === "P2034" ||
                (error.code === "P2010" && (
                    meta?.code === "40001" ||
                    (typeof meta?.message === "string" && meta.message.includes("could not serialize access")) ||
                    error.message.includes("40001")
                ))
            )
            const retryable = isKnown && (serializationFailure || error.code === "P2002")
            if (!retryable) throw error

            const provenance = await classifyCurrentProvenance(prisma, group)
            if (provenance.state === "already-applied") {
                return { state: "already-applied", orderId: provenance.orderId }
            }
            if (provenance.state === "conflict") {
                throw new BackfillConflictError(
                    `Provenance conflict after ${error.code} for group ${group.groupRef}: ${provenance.reasons.join(", ")}`,
                )
            }
            if (attempt === MAX_TRANSACTION_ATTEMPTS) throw error
        }
    }

    throw new Error(`Backfill retry loop exhausted for group ${group.groupRef}.`)
}

async function main() {
    const options = parseCliOptions(process.argv.slice(2))
    if (options.help) {
        console.log(usage())
        return
    }

    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error("DATABASE_URL is required; it is not loaded implicitly by this script.")
    const databaseName = databaseNameFromUrl(databaseUrl)
    if (options.expectedDatabase && options.expectedDatabase !== databaseName) {
        throw new Error(
            `Database acknowledgement mismatch: expected ${options.expectedDatabase}, DATABASE_URL targets ${databaseName}.`,
        )
    }

    const prisma = new PrismaClient()
    try {
        const candidates = await prisma.productPurchase.findMany({
            where: {
                createdAt: { lt: options.cutoff },
                product: { profile: { roleTemplate: "RESTAURANT" } },
            },
            select: purchaseSelect,
        })
        const groups = buildProvisionalGroups(candidates)
        const provenance = await loadProvenanceIndex(prisma, groups)
        const entries = planEntries(groups, provenance)
        const conflicts = entries.filter((entry) => entry.state === "provenance-conflict")
        const unsafe = entries.filter((entry) => entry.state === "unsafe")

        if (!options.apply) {
            console.log(JSON.stringify(
                sanitizedPlanReport(databaseName, options, candidates, groups, entries),
                null,
                2,
            ))
            if (conflicts.length > 0 || unsafe.length > 0) process.exitCode = 2
            return
        }

        if (conflicts.length > 0) {
            console.log(JSON.stringify(
                sanitizedPlanReport(databaseName, options, candidates, groups, entries),
                null,
                2,
            ))
            process.exitCode = 2
            return
        }

        const eligible = entries
            .filter((entry): entry is Extract<PlannedEntry, { state: "eligible" }> => entry.state === "eligible")
            .sort((a, b) =>
                compareStrings(a.plan.profileId, b.plan.profileId) ||
                a.plan.businessDate.getTime() - b.plan.businessDate.getTime() ||
                a.plan.placedAt.getTime() - b.plan.placedAt.getTime() ||
                compareStrings(a.plan.legacyGroupKey, b.plan.legacyGroupKey))
        const results: ApplyResult[] = []
        for (const entry of eligible) results.push(await applyOneGroup(prisma, entry.plan))

        console.log(JSON.stringify(
            sanitizedPlanReport(databaseName, options, candidates, groups, entries, results),
            null,
            2,
        ))
        if (unsafe.length > 0) process.exitCode = 2
    } finally {
        await prisma.$disconnect()
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})
