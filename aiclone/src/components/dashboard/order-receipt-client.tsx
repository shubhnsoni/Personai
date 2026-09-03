"use client"

import Link from "next/link"
import { ReceiptPrinter } from "@/components/shop/receipt-printer"
import type { ReceiptData } from "@/lib/receipt"

export function OrderReceiptClient({ data }: { data: ReceiptData }) {
    return (
        <div className="min-h-dvh bg-zinc-950">
            <div className="print:hidden mx-auto flex max-w-md items-center justify-between px-4 py-4">
                <Link href="/dashboard/orders" className="text-sm text-zinc-400">Back to kitchen</Link>
            </div>
            <ReceiptPrinter data={data} onClose={() => { window.location.href = "/dashboard/orders" }} />
        </div>
    )
}
