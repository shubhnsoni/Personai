export const DISTRO_LOCATIONS = ["Ranchi", "Jamshedpur"] as const
export const DISTRO_SALESMEN = [
    "SUNNY", "PANKAJ", "MILAN", "RAJESH", "PRATAP", "SHAHZAD", "SANJEEB ROY", "RITIK", "JITENDER",
] as const

export type DistroApproval = "PENDING" | "APPROVED" | "NOT_APPROVED" | "ON_HOLD"
export type DistroWarehouse = "WAITING" | "DISPATCHED" | "NO_STOCK"
export type DistroAccounts = "HOLD" | "BILLED" | "NO_STOCK"

export type DistroMeta = {
    salesman: string
    location: string
    dealer: string
    approval: DistroApproval
    warehouse: DistroWarehouse
    accounts: DistroAccounts
    invoice: string
}

const DEFAULT: DistroMeta = {
    salesman: "",
    location: DISTRO_LOCATIONS[0],
    dealer: "",
    approval: "PENDING",
    warehouse: "WAITING",
    accounts: "HOLD",
    invoice: "",
}

export function parseDistroMeta(staffNote?: string | null, guestName?: string | null, tableLabel?: string | null): DistroMeta {
    const base: DistroMeta = {
        ...DEFAULT,
        dealer: guestName || "",
        location: tableLabel && DISTRO_LOCATIONS.includes(tableLabel as typeof DISTRO_LOCATIONS[number]) ? tableLabel : DEFAULT.location,
    }
    if (!staffNote) return base
    try {
        const o = JSON.parse(staffNote) as Partial<DistroMeta>
        if (!o || typeof o !== "object") return base
        return {
            salesman: typeof o.salesman === "string" ? o.salesman : base.salesman,
            location: typeof o.location === "string" && o.location ? o.location : base.location,
            dealer: typeof o.dealer === "string" && o.dealer ? o.dealer : base.dealer,
            approval: o.approval === "APPROVED" || o.approval === "NOT_APPROVED" || o.approval === "ON_HOLD" || o.approval === "PENDING" ? o.approval : base.approval,
            warehouse: o.warehouse === "DISPATCHED" || o.warehouse === "NO_STOCK" || o.warehouse === "WAITING" ? o.warehouse : base.warehouse,
            accounts: o.accounts === "BILLED" || o.accounts === "NO_STOCK" || o.accounts === "HOLD" ? o.accounts : base.accounts,
            invoice: typeof o.invoice === "string" ? o.invoice : base.invoice,
        }
    } catch {
        return base
    }
}

export function writeDistroMeta(meta: DistroMeta) {
    return JSON.stringify(meta)
}

export function distroTab(meta: DistroMeta): "pending" | "approved" | "dispatch" | "billed" {
    if (meta.accounts === "BILLED") return "billed"
    if (meta.warehouse === "DISPATCHED" || meta.warehouse === "NO_STOCK") return "dispatch"
    if (meta.approval === "APPROVED") return "approved"
    return "pending"
}

export function lineAmountPaise(qty: number, unitPaise: number) {
    return Math.max(0, qty) * Math.max(0, unitPaise)
}

export function orderTotalPaise(lines: { qty: number; unitPaise: number }[]) {
    return lines.reduce((sum, l) => sum + lineAmountPaise(l.qty, l.unitPaise), 0)
}

export function isDistributor(role?: string | null) {
    return role === "DISTRIBUTOR"
}
