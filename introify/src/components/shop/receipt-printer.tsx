"use client"

import { useEffect } from "react"
import { openReceiptPdf, type ReceiptData } from "@/lib/receipt"

export function ReceiptPrinter({
    data,
    onClose,
}: {
    data: ReceiptData
    onClose: () => void
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])

    const buyerName = data.buyerName || data.guestName || "—"
    const buyerPlace = data.buyerPlace || data.tableLabel || ""
    const invoiceDate = data.invoiceDate || data.placedAt

    return (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 print:static print:bg-white print:p-0">
            <button type="button" className="absolute inset-0 print:hidden" aria-label="Close receipt" onClick={onClose} />
            <div className="relative z-[1] w-full max-w-[210mm] print:max-w-none">
                {/* On-screen only chrome — never cyan; hidden when printing */}
                <div className="mb-3 flex items-center justify-between print:hidden">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Tax invoice preview</p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="rounded-full bg-zinc-950 px-4 py-2 text-[12px] font-semibold text-white"
                            onClick={() => openReceiptPdf(data)}
                        >
                            Print / PDF
                        </button>
                        <button type="button" className="rounded-full border border-zinc-500 px-4 py-2 text-[12px] text-zinc-200" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>

                {/* A4 white print sheet — Designer bar; no cyan chrome */}
                <article className="mx-auto w-full bg-white px-8 py-8 text-[#111] shadow-[0_18px_40px_rgba(0,0,0,0.28)] print:shadow-none print:px-0 print:py-0">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[18px] font-semibold tracking-wide">{data.shopName}</p>
                            {data.gstin ? <p className="mt-1 font-mono text-[11px] text-zinc-600">GSTIN {data.gstin}</p> : null}
                            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">Tax invoice</p>
                        </div>
                        <div className="text-right">
                            <p className="font-mono text-[13px] font-semibold">{data.invoice || `Order #${data.number}`}</p>
                            <p className="mt-1 font-mono text-[11px] text-zinc-600">{invoiceDate}</p>
                        </div>
                    </div>

                    <div className="my-4 border-t border-zinc-900" />

                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Bill to</p>
                        <p className="mt-1 text-[13px] font-semibold">{buyerName}</p>
                        {data.buyerGstin ? <p className="font-mono text-[11px] text-zinc-600">GSTIN {data.buyerGstin}</p> : null}
                        {buyerPlace ? <p className="text-[11px] text-zinc-600">{buyerPlace}</p> : null}
                    </div>

                    <div className="my-4 border-t border-zinc-900" />

                    <table className="w-full border-collapse text-[11px]">
                        <thead>
                            <tr className="border-b border-zinc-900 text-left text-[10px] uppercase tracking-[0.08em] text-zinc-500">
                                <th className="py-2 pr-2 font-semibold">HSN/SAC</th>
                                <th className="py-2 pr-2 font-semibold">Description</th>
                                <th className="py-2 pr-2 text-right font-semibold">Qty</th>
                                <th className="py-2 pr-2 text-right font-semibold">Rate</th>
                                <th className="py-2 pr-2 text-right font-semibold">Taxable</th>
                                <th className="py-2 text-right font-semibold">Tax</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.lines.map((line, i) => (
                                <tr key={`${line.title}-${i}`} className="border-b border-zinc-200 align-top">
                                    <td className="py-2 pr-2 font-mono">{line.hsn || "—"}</td>
                                    <td className="py-2 pr-2">
                                        {line.title}
                                        {line.modifiersLabel ? <span className="mt-0.5 block text-[10px] text-zinc-500">{line.modifiersLabel}</span> : null}
                                    </td>
                                    <td className="py-2 pr-2 text-right font-mono">{line.qty}</td>
                                    <td className="py-2 pr-2 text-right font-mono">{line.rate || line.lineTotal}</td>
                                    <td className="py-2 pr-2 text-right font-mono">{line.taxable || line.lineTotal}</td>
                                    <td className="py-2 text-right font-mono">{line.tax || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="mt-4 ml-auto w-full max-w-[16rem] space-y-1 text-[12px]">
                        {data.taxable
                            ? <div className="flex justify-between"><span>Taxable</span><span className="font-mono">{data.taxable}</span></div>
                            : <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{data.subtotal}</span></div>}
                        {(data.gstLines && data.gstLines.length > 0)
                            ? data.gstLines.map((g) => (
                                <div key={g.label} className="flex justify-between"><span>{g.label}</span><span className="font-mono">{g.amount}</span></div>
                            ))
                            : (data.tax ? <div className="flex justify-between"><span>Tax</span><span className="font-mono">{data.tax}</span></div> : null)}
                        <div className="mt-2 flex justify-between border-t border-zinc-900 pt-2 text-[14px] font-bold">
                            <span>Grand total</span>
                            <span className="font-mono">{data.total}</span>
                        </div>
                    </div>

                    {data.upiId ? <p className="mt-4 font-mono text-[11px] text-zinc-600">UPI {data.upiId}</p> : null}
                    <p className="mt-2 text-[10px] text-zinc-500">{data.payMethod || "Bill"} · {data.payStatus} · {data.status}</p>
                </article>
            </div>
        </div>
    )
}
